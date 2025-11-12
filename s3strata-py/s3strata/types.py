"""Core types and interfaces for S3Strata"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Callable, List, Optional, Union


class StorageTier(str, Enum):
    """Storage tier enumeration"""

    HOT = "HOT"
    COLD = "COLD"


class FileVisibility(str, Enum):
    """File visibility levels"""

    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


@dataclass
class PhysicalFile:
    """
    Physical file record representing a file stored in object storage
    This is the core DTO that storage adapters must implement
    """

    id: Union[str, int]
    storage_tier: Union[StorageTier, str]  # Accepts "HOT" | "COLD" for compatibility
    filename: str
    path: str
    hot_until: Optional[datetime]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class StorageAdapter(ABC):
    """
    Storage adapter interface for database operations
    Implement this interface to integrate with your own database/ORM
    """

    @abstractmethod
    async def create(
        self,
        storage_tier: StorageTier,
        filename: str,
        path: str,
        hot_until: Optional[datetime],
    ) -> PhysicalFile:
        """Create a new file record"""
        pass

    @abstractmethod
    async def find_by_id(self, id: Union[str, int]) -> Optional[PhysicalFile]:
        """Find file by ID"""
        pass

    @abstractmethod
    async def update(
        self,
        id: Union[str, int],
        storage_tier: Optional[StorageTier] = None,
        path: Optional[str] = None,
        hot_until: Optional[datetime] = None,
    ) -> PhysicalFile:
        """Update file record"""
        pass

    @abstractmethod
    async def delete(self, id: Union[str, int]) -> None:
        """Delete file record"""
        pass

    @abstractmethod
    async def find_expired_hot_files(self) -> List[PhysicalFile]:
        """Find all HOT files where hot_until has passed"""
        pass

    @abstractmethod
    async def find_all(self) -> List[PhysicalFile]:
        """Find all file records"""
        pass


@dataclass
class UploadOptions:
    """Options for uploading files"""

    tier: Optional[StorageTier] = None
    visibility: Optional[FileVisibility] = None
    filename: Optional[str] = None
    path_suffix: Optional[str] = None
    hot_duration: Optional[int] = None  # Duration in seconds


@dataclass
class GetUrlOptions:
    """Options for generating file URLs"""

    expires_in: Optional[int] = None  # Duration in seconds


@dataclass
class SetVisibilityOptions:
    """Options for changing file visibility"""

    visibility: FileVisibility
    move_file: bool = True


@dataclass
class SetTierOptions:
    """Options for changing storage tier"""

    tier: StorageTier
    move_file: bool = True
    hot_duration: Optional[int] = None  # Duration in seconds


@dataclass
class SetHotDurationOptions:
    """Options for setting hot storage duration"""

    duration: Optional[int]  # Duration in seconds, None to clear


@dataclass
class S3Object:
    """Represents an object in S3 bucket"""

    key: str
    last_modified: Optional[datetime] = None
    size: Optional[int] = None
    etag: Optional[str] = None
    storage_class: Optional[str] = None


@dataclass
class OrphanObject(S3Object):
    """An S3 object that doesn't have a database record"""

    tier: StorageTier = StorageTier.HOT
    bucket: str = ""


@dataclass
class BucketObjects:
    """Objects in a specific bucket"""

    tier: StorageTier
    bucket: str
    objects: List[S3Object]
    count: int


@dataclass
class AllBucketObjects:
    """All objects across both storage tiers"""

    hot: BucketObjects
    cold: BucketObjects
    total_count: int
    collected_at: datetime


@dataclass
class DeleteOrphanOptions:
    """Options for deleting orphan objects"""

    prefix: Optional[str] = None
    tier: Optional[StorageTier] = None
    dry_run: bool = False


@dataclass
class DeleteOrphanResult:
    """Result of deleting orphan objects"""

    deleted: int
    failed: int
    deleted_paths: List[str]
    errors: List[dict]
    dry_run: bool


@dataclass
class AdoptOrphanOptions:
    """Options for adopting orphan objects"""

    prefix: Optional[str] = None
    tier: Optional[StorageTier] = None
    extract_filename: Optional[Callable[[str], str]] = None
    set_hot_until: bool = False
    hot_duration: Optional[int] = None  # Duration in seconds


@dataclass
class AdoptOrphanResult:
    """Result of adopting orphan objects"""

    adopted: int
    failed: int
    adopted_file_ids: List[Union[str, int]]
    errors: List[dict]
