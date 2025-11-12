"""High-level file management service"""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from .config import (
    S3StrataConfig,
    get_bucket_name,
    get_default_presigned_url_expiration,
    get_default_storage_tier,
    get_default_visibility,
    get_path_prefix,
)
from .objectstore import ObjectStoreService
from .types import (
    AdoptOrphanOptions,
    AdoptOrphanResult,
    AllBucketObjects,
    BucketObjects,
    DeleteOrphanOptions,
    DeleteOrphanResult,
    FileVisibility,
    GetUrlOptions,
    OrphanObject,
    PhysicalFile,
    SetHotDurationOptions,
    SetTierOptions,
    SetVisibilityOptions,
    StorageAdapter,
    StorageTier,
    UploadOptions,
)


class FileManager:
    """
    High-level file management service
    Works with PhysicalFile model via StorageAdapter
    """

    def __init__(self, config: S3StrataConfig, adapter: StorageAdapter):
        self.config = config
        self.adapter = adapter
        self.objectstore = ObjectStoreService(config)

    def _get_visibility_from_path(self, path: str) -> FileVisibility:
        """Parse visibility from path"""
        if path.startswith("public/"):
            return FileVisibility.PUBLIC
        if path.startswith("private/"):
            return FileVisibility.PRIVATE
        raise ValueError(f"Invalid path format: {path}")

    def _build_path(self, tier: StorageTier, visibility: FileVisibility, path_suffix: str) -> str:
        """Build full S3 path from tier, visibility, and custom path"""
        prefix = get_path_prefix(self.config, tier, visibility)
        return f"{prefix}/{path_suffix}"

    def _normalize_tier(self, tier: StorageTier | str) -> StorageTier:
        """Normalize storage tier value to enum"""
        if isinstance(tier, str):
            return StorageTier(tier)
        return tier

    async def upload(self, data: bytes, options: Optional[UploadOptions] = None) -> PhysicalFile:
        """Upload a file to object storage"""
        if options is None:
            options = UploadOptions()

        tier = options.tier or get_default_storage_tier(self.config)
        visibility = options.visibility or get_default_visibility(self.config)

        # Generate filename and path
        filename = options.filename or str(uuid.uuid4())
        path_suffix = options.path_suffix or f"{uuid.uuid4()}-{filename}"
        full_path = self._build_path(tier, visibility, path_suffix)

        # Calculate hot_until if hotDuration is provided and tier is HOT
        hot_until: Optional[datetime] = None
        if tier == StorageTier.HOT and options.hot_duration is not None:
            hot_until = datetime.now() + timedelta(seconds=options.hot_duration)

        # Upload to S3
        await self.objectstore.upload(tier, full_path, data)

        # Create database record via adapter
        physical_file = await self.adapter.create(
            storage_tier=tier,
            filename=filename,
            path=full_path,
            hot_until=hot_until,
        )

        return physical_file

    async def get_url(self, file: PhysicalFile, options: Optional[GetUrlOptions] = None) -> str:
        """
        Generate URL for a file
        - PUBLIC files: returns direct URL
        - PRIVATE files: returns presigned URL
        """
        if options is None:
            options = GetUrlOptions()

        tier = self._normalize_tier(file.storage_tier)
        visibility = self._get_visibility_from_path(file.path)

        if visibility == FileVisibility.PUBLIC:
            # Return direct public URL
            return self.objectstore.get_public_url(tier, file.path)

        # Return presigned URL for private files
        expires_in = options.expires_in or get_default_presigned_url_expiration(self.config)
        return await self.objectstore.get_presigned_url(tier, file.path, expires_in)

    async def set_visibility(
        self,
        file: PhysicalFile,
        options: SetVisibilityOptions,
    ) -> PhysicalFile:
        """
        Change file visibility (PUBLIC <-> PRIVATE)
        Moves file between /public and /private prefixes
        """
        tier = self._normalize_tier(file.storage_tier)
        current_visibility = self._get_visibility_from_path(file.path)
        new_visibility = options.visibility

        # No change needed
        if current_visibility == new_visibility:
            return file

        # Extract path suffix (everything after visibility prefix)
        current_prefix = get_path_prefix(self.config, tier, current_visibility)
        path_suffix = file.path[len(current_prefix) + 1 :]  # +1 for the slash

        # Build new path
        new_path = self._build_path(tier, new_visibility, path_suffix)

        # Move file in S3 if requested
        if options.move_file:
            await self.objectstore.move(tier, file.path, tier, new_path)

        # Update database via adapter
        updated_file = await self.adapter.update(file.id, path=new_path)

        return updated_file

    async def set_tier(self, file: PhysicalFile, options: SetTierOptions) -> PhysicalFile:
        """Move file between storage tiers (HOT <-> COLD)"""
        current_tier = self._normalize_tier(file.storage_tier)
        new_tier = options.tier

        # No change needed
        if current_tier == new_tier:
            return file

        # Calculate hot_until if moving to HOT and hotDuration is provided
        hot_until: Optional[datetime] = None
        update_hot_until = False

        if new_tier == StorageTier.HOT:
            if options.hot_duration is not None:
                hot_until = datetime.now() + timedelta(seconds=options.hot_duration)
                update_hot_until = True
        else:
            # Moving to COLD, clear hot_until
            hot_until = None
            update_hot_until = True

        # Move file in S3 if requested
        if options.move_file:
            await self.objectstore.move(
                current_tier,
                file.path,
                new_tier,
                file.path,  # Keep same path (visibility stays the same)
            )

        # Update database via adapter
        if update_hot_until:
            updated_file = await self.adapter.update(
                file.id,
                storage_tier=new_tier,
                hot_until=hot_until,
            )
        else:
            updated_file = await self.adapter.update(file.id, storage_tier=new_tier)

        return updated_file

    async def delete(self, file: PhysicalFile) -> None:
        """Delete a file from storage and database"""
        tier = self._normalize_tier(file.storage_tier)

        # Delete from S3
        await self.objectstore.delete(tier, file.path)

        # Delete from database via adapter
        await self.adapter.delete(file.id)

    async def get_by_id(self, id: str | int) -> Optional[PhysicalFile]:
        """Get file from database by ID"""
        return await self.adapter.find_by_id(id)

    async def exists(self, file: PhysicalFile) -> bool:
        """Check if file exists in storage"""
        tier = self._normalize_tier(file.storage_tier)
        return await self.objectstore.exists(tier, file.path)

    async def set_hot_duration(
        self,
        file: PhysicalFile,
        options: SetHotDurationOptions,
    ) -> PhysicalFile:
        """
        Set hot storage duration for a file
        Only applicable to HOT tier files
        """
        tier = self._normalize_tier(file.storage_tier)

        # Only applies to HOT tier files
        if tier != StorageTier.HOT:
            raise ValueError("set_hot_duration only applies to HOT tier files")

        hot_until: Optional[datetime] = None
        if options.duration is not None:
            if options.duration == 0:
                # Mark for immediate archival
                hot_until = datetime.now()
            else:
                hot_until = datetime.now() + timedelta(seconds=options.duration)

        # Update database via adapter
        updated_file = await self.adapter.update(file.id, hot_until=hot_until)

        return updated_file

    async def archive_expired_hot_files(self) -> int:
        """
        Housekeeping: Move expired HOT files to COLD storage
        Returns the number of files moved
        """
        # Find all HOT files where hot_until has passed via adapter
        expired_files = await self.adapter.find_expired_hot_files()

        moved_count = 0
        for file in expired_files:
            try:
                await self.set_tier(
                    file,
                    SetTierOptions(tier=StorageTier.COLD, move_file=True),
                )
                moved_count += 1
            except Exception as e:
                print(f"Failed to archive file {file.id}: {e}")
                # Continue with other files

        return moved_count

    async def list_files(self) -> List[PhysicalFile]:
        """List all files from the database"""
        return await self.adapter.find_all()

    async def list_all_objects(self, prefix: Optional[str] = None) -> AllBucketObjects:
        """
        INTERNAL/DEV: List all objects in all S3 buckets
        Returns a comprehensive JSON structure with all objects across both tiers
        Useful for debugging and inspecting the actual S3 state
        """
        hot_objects, cold_objects = await asyncio.gather(
            self.objectstore.list_objects(StorageTier.HOT, prefix),
            self.objectstore.list_objects(StorageTier.COLD, prefix),
        )

        hot_bucket = BucketObjects(
            tier=StorageTier.HOT,
            bucket=get_bucket_name(self.config, StorageTier.HOT),
            objects=hot_objects,
            count=len(hot_objects),
        )

        cold_bucket = BucketObjects(
            tier=StorageTier.COLD,
            bucket=get_bucket_name(self.config, StorageTier.COLD),
            objects=cold_objects,
            count=len(cold_objects),
        )

        return AllBucketObjects(
            hot=hot_bucket,
            cold=cold_bucket,
            total_count=len(hot_objects) + len(cold_objects),
            collected_at=datetime.now(),
        )

    async def list_orphan_objects(self, prefix: Optional[str] = None) -> List[OrphanObject]:
        """
        List all orphan objects (objects in S3 that don't have a PhysicalFile record)
        Returns objects that exist in S3 but are not tracked in the database
        """
        # Get all objects from S3
        hot_objects, cold_objects, db_files = await asyncio.gather(
            self.objectstore.list_objects(StorageTier.HOT, prefix),
            self.objectstore.list_objects(StorageTier.COLD, prefix),
            self.adapter.find_all(),
        )

        # Build a Set of all paths that exist in the database
        db_paths = {file.path for file in db_files}

        # Find orphans in HOT tier
        hot_orphans = [
            OrphanObject(
                key=obj.key,
                last_modified=obj.last_modified,
                size=obj.size,
                etag=obj.etag,
                storage_class=obj.storage_class,
                tier=StorageTier.HOT,
                bucket=get_bucket_name(self.config, StorageTier.HOT),
            )
            for obj in hot_objects
            if obj.key not in db_paths
        ]

        # Find orphans in COLD tier
        cold_orphans = [
            OrphanObject(
                key=obj.key,
                last_modified=obj.last_modified,
                size=obj.size,
                etag=obj.etag,
                storage_class=obj.storage_class,
                tier=StorageTier.COLD,
                bucket=get_bucket_name(self.config, StorageTier.COLD),
            )
            for obj in cold_objects
            if obj.key not in db_paths
        ]

        return hot_orphans + cold_orphans

    async def delete_orphan_objects(
        self,
        options: Optional[DeleteOrphanOptions] = None,
    ) -> DeleteOrphanResult:
        """
        Delete orphan objects from S3
        Removes objects that exist in S3 but don't have a PhysicalFile record
        """
        if options is None:
            options = DeleteOrphanOptions()

        orphans = await self.list_orphan_objects(options.prefix)

        # Filter by tier if specified
        filtered_orphans = (
            [o for o in orphans if o.tier == options.tier] if options.tier else orphans
        )

        result = DeleteOrphanResult(
            deleted=0,
            failed=0,
            deleted_paths=[],
            errors=[],
            dry_run=options.dry_run,
        )

        for orphan in filtered_orphans:
            try:
                if not options.dry_run:
                    await self.objectstore.delete(orphan.tier, orphan.key)
                result.deleted += 1
                result.deleted_paths.append(orphan.key)
            except Exception as e:
                result.failed += 1
                result.errors.append(
                    {
                        "path": orphan.key,
                        "error": str(e),
                    }
                )

        return result

    async def adopt_orphan_objects(
        self,
        options: Optional[AdoptOrphanOptions] = None,
    ) -> AdoptOrphanResult:
        """
        Adopt orphan objects by creating PhysicalFile records for them
        Creates database entries for objects that exist in S3 but aren't tracked
        """
        if options is None:
            options = AdoptOrphanOptions()

        orphans = await self.list_orphan_objects(options.prefix)

        # Filter by tier if specified
        filtered_orphans = (
            [o for o in orphans if o.tier == options.tier] if options.tier else orphans
        )

        result = AdoptOrphanResult(
            adopted=0,
            failed=0,
            adopted_file_ids=[],
            errors=[],
        )

        # Default filename extractor: use the last segment of the path
        extract_filename = options.extract_filename or (lambda path: path.split("/")[-1])

        for orphan in filtered_orphans:
            try:
                filename = extract_filename(orphan.key)

                # Calculate hot_until if specified
                hot_until: Optional[datetime] = None
                if (
                    orphan.tier == StorageTier.HOT
                    and options.set_hot_until
                    and options.hot_duration is not None
                ):
                    hot_until = datetime.now() + timedelta(seconds=options.hot_duration)

                physical_file = await self.adapter.create(
                    storage_tier=orphan.tier,
                    filename=filename,
                    path=orphan.key,
                    hot_until=hot_until,
                )

                result.adopted += 1
                result.adopted_file_ids.append(physical_file.id)
            except Exception as e:
                result.failed += 1
                result.errors.append(
                    {
                        "path": orphan.key,
                        "error": str(e),
                    }
                )

        return result
