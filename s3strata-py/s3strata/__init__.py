"""S3Strata - Object storage abstraction layer with dual-bucket tiered storage"""

from .config import (
    S3StrataAdvancedOptions,
    S3StrataConfig,
    S3TierConfig,
    get_bucket_name,
    get_default_presigned_url_expiration,
    get_default_storage_tier,
    get_default_visibility,
    get_max_file_size,
    get_path_prefix,
    get_tier_config,
)
from .file_manager import FileManager
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
    S3Object,
    SetHotDurationOptions,
    SetTierOptions,
    SetVisibilityOptions,
    StorageAdapter,
    StorageTier,
    UploadOptions,
)

__version__ = "1.5.0"

__all__ = [
    # Config
    "S3StrataAdvancedOptions",
    "S3StrataConfig",
    "S3TierConfig",
    "get_bucket_name",
    "get_default_presigned_url_expiration",
    "get_default_storage_tier",
    "get_default_visibility",
    "get_max_file_size",
    "get_path_prefix",
    "get_tier_config",
    # Services
    "FileManager",
    "ObjectStoreService",
    # Types
    "FileVisibility",
    "PhysicalFile",
    "StorageAdapter",
    "StorageTier",
    "UploadOptions",
    "GetUrlOptions",
    "SetVisibilityOptions",
    "SetTierOptions",
    "SetHotDurationOptions",
    "AdoptOrphanOptions",
    "AdoptOrphanResult",
    "DeleteOrphanOptions",
    "DeleteOrphanResult",
    "OrphanObject",
    "S3Object",
    "AllBucketObjects",
    "BucketObjects",
]
