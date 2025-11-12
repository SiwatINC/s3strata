"""Low-level S3 operations abstraction"""

from typing import List, Optional
from urllib.parse import quote

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from .config import S3StrataConfig, S3TierConfig, get_tier_config
from .types import S3Object, StorageTier


class ObjectStoreService:
    """
    Low-level S3 operations abstraction
    Handles dual-bucket (HOT/COLD) architecture
    Supports different S3 endpoints for each tier
    """

    def __init__(self, config: S3StrataConfig):
        self.hot_config = get_tier_config(config, StorageTier.HOT)
        self.cold_config = get_tier_config(config, StorageTier.COLD)
        self.hot_client = self._create_client(self.hot_config)
        self.cold_client = self._create_client(self.cold_config)

    def _create_client(self, tier_config: S3TierConfig):
        """Create S3 client for a specific tier configuration"""
        protocol = "https" if tier_config.use_ssl else "http"
        port = tier_config.port

        # Only include port in endpoint if it's non-standard
        is_standard_port = (protocol == "http" and port == 80) or (
            protocol == "https" and port == 443
        )
        endpoint_url = (
            f"{protocol}://{tier_config.endpoint}"
            if is_standard_port
            else f"{protocol}://{tier_config.endpoint}:{port}"
        )

        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=tier_config.access_key,
            aws_secret_access_key=tier_config.secret_key,
            config=Config(signature_version="s3v4"),
        )

    def _get_client(self, tier: StorageTier):
        """Get client for a specific tier"""
        return self.hot_client if tier == StorageTier.HOT else self.cold_client

    def _get_config(self, tier: StorageTier) -> S3TierConfig:
        """Get configuration for a specific tier"""
        return self.hot_config if tier == StorageTier.HOT else self.cold_config

    async def upload(self, tier: StorageTier, path: str, data: bytes) -> None:
        """Upload a file to S3"""
        client = self._get_client(tier)
        config = self._get_config(tier)

        client.put_object(
            Bucket=config.bucket,
            Key=path,
            Body=data,
        )

    async def download(self, tier: StorageTier, path: str) -> bytes:
        """Download a file from S3"""
        client = self._get_client(tier)
        config = self._get_config(tier)

        try:
            response = client.get_object(Bucket=config.bucket, Key=path)
            return response["Body"].read()
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"File not found: {path}") from e
            raise

    async def delete(self, tier: StorageTier, path: str) -> None:
        """Delete a file from S3"""
        client = self._get_client(tier)
        config = self._get_config(tier)

        client.delete_object(Bucket=config.bucket, Key=path)

    async def copy(
        self,
        source_tier: StorageTier,
        source_path: str,
        dest_tier: StorageTier,
        dest_path: str,
    ) -> None:
        """Copy a file within or between tiers"""
        # Download from source
        data = await self.download(source_tier, source_path)

        # Upload to destination
        await self.upload(dest_tier, dest_path, data)

    async def move(
        self,
        source_tier: StorageTier,
        source_path: str,
        dest_tier: StorageTier,
        dest_path: str,
    ) -> None:
        """Move a file within or between tiers"""
        # Copy to destination
        await self.copy(source_tier, source_path, dest_tier, dest_path)

        # Delete from source
        await self.delete(source_tier, source_path)

    async def exists(self, tier: StorageTier, path: str) -> bool:
        """Check if a file exists"""
        client = self._get_client(tier)
        config = self._get_config(tier)

        try:
            client.head_object(Bucket=config.bucket, Key=path)
            return True
        except ClientError:
            return False

    async def get_presigned_url(self, tier: StorageTier, path: str, expires_in: int) -> str:
        """Generate a presigned URL for private file access"""
        client = self._get_client(tier)
        config = self._get_config(tier)

        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": config.bucket, "Key": path},
            ExpiresIn=expires_in,
        )

    def get_public_url(self, tier: StorageTier, path: str) -> str:
        """Generate a public URL"""
        config = self._get_config(tier)
        protocol = "https" if config.use_ssl else "http"
        port = config.port
        port_suffix = "" if port in (443, 80) else f":{port}"

        return (
            f"{protocol}://{config.endpoint}{port_suffix}/{config.bucket}/{quote(path, safe='/')}"
        )

    async def list_objects(self, tier: StorageTier, prefix: Optional[str] = None) -> List[S3Object]:
        """
        List all objects in a specific tier's bucket
        Handles pagination automatically to retrieve all objects
        """
        client = self._get_client(tier)
        config = self._get_config(tier)

        objects: List[S3Object] = []
        continuation_token: Optional[str] = None

        while True:
            params = {"Bucket": config.bucket}
            if prefix:
                params["Prefix"] = prefix
            if continuation_token:
                params["ContinuationToken"] = continuation_token

            response = client.list_objects_v2(**params)

            if "Contents" in response:
                for item in response["Contents"]:
                    objects.append(
                        S3Object(
                            key=item["Key"],
                            last_modified=item.get("LastModified"),
                            size=item.get("Size"),
                            etag=item.get("ETag"),
                            storage_class=item.get("StorageClass"),
                        )
                    )

            if not response.get("IsTruncated", False):
                break

            continuation_token = response.get("NextContinuationToken")

        return objects
