"""Configuration for S3Strata"""

from dataclasses import dataclass, field
from typing import Optional

from .types import FileVisibility, StorageTier


@dataclass
class S3StrataAdvancedOptions:
    """Advanced options for S3Strata behavior"""

    default_presigned_url_expiration: int = 14400  # 4 hours
    max_file_size: float = float("inf")  # No limit by default
    default_storage_tier: StorageTier = StorageTier.HOT
    default_visibility: FileVisibility = FileVisibility.PRIVATE


@dataclass
class S3TierConfig:
    """S3 tier-specific configuration"""

    endpoint: str
    access_key: str
    secret_key: str
    bucket: str
    port: int = 443
    use_ssl: bool = True
    public_prefix: str = "public"
    private_prefix: str = "private"


@dataclass
class S3StrataConfig:
    """
    Configuration for S3Strata
    Supports two modes:
    1. Shared endpoint mode: Single endpoint/credentials for both tiers
    2. Separate endpoint mode: Different endpoints/credentials per tier
    """

    # Shared endpoint mode (backward compatible)
    endpoint: Optional[str] = None
    port: Optional[int] = None
    use_ssl: Optional[bool] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    hot_bucket: Optional[str] = None
    cold_bucket: Optional[str] = None
    public_hot_prefix: Optional[str] = None
    private_hot_prefix: Optional[str] = None
    public_cold_prefix: Optional[str] = None
    private_cold_prefix: Optional[str] = None

    # Separate endpoint mode
    hot: Optional[S3TierConfig] = None
    cold: Optional[S3TierConfig] = None

    # Advanced options
    advanced: S3StrataAdvancedOptions = field(default_factory=S3StrataAdvancedOptions)


def get_tier_config(config: S3StrataConfig, tier: StorageTier) -> S3TierConfig:
    """Get tier configuration, resolving shared vs separate endpoint config"""
    # If tier-specific config is provided, use it
    if tier == StorageTier.HOT and config.hot:
        return config.hot
    if tier == StorageTier.COLD and config.cold:
        return config.cold

    # Fall back to shared config
    if not config.endpoint or not config.access_key or not config.secret_key:
        raise ValueError(
            f"Missing S3 configuration for {tier} tier. Provide either shared config "
            f"(endpoint, access_key, secret_key, {'hot_bucket' if tier == StorageTier.HOT else 'cold_bucket'}) "
            f"or tier-specific config ({tier.lower()})."
        )

    bucket = config.hot_bucket if tier == StorageTier.HOT else config.cold_bucket
    if not bucket:
        raise ValueError(
            f"Missing bucket configuration for {tier} tier. Provide either "
            f"{'hot_bucket' if tier == StorageTier.HOT else 'cold_bucket'} or {tier.lower()}.bucket"
        )

    return S3TierConfig(
        endpoint=config.endpoint,
        port=config.port if config.port is not None else 443,
        use_ssl=config.use_ssl if config.use_ssl is not None else True,
        access_key=config.access_key,
        secret_key=config.secret_key,
        bucket=bucket,
        public_prefix=(
            config.public_hot_prefix
            if tier == StorageTier.HOT
            else config.public_cold_prefix or "public"
        ),
        private_prefix=(
            config.private_hot_prefix
            if tier == StorageTier.HOT
            else config.private_cold_prefix or "private"
        ),
    )


def get_bucket_name(config: S3StrataConfig, tier: StorageTier) -> str:
    """Get bucket name for a storage tier"""
    return get_tier_config(config, tier).bucket


def get_path_prefix(
    config: S3StrataConfig,
    tier: StorageTier,
    visibility: FileVisibility,
) -> str:
    """Get path prefix for a tier and visibility combination"""
    tier_config = get_tier_config(config, tier)
    if visibility == FileVisibility.PUBLIC:
        return tier_config.public_prefix
    return tier_config.private_prefix


def get_default_presigned_url_expiration(config: S3StrataConfig) -> int:
    """Get default presigned URL expiration from config (in seconds)"""
    return config.advanced.default_presigned_url_expiration


def get_max_file_size(config: S3StrataConfig) -> float:
    """Get maximum file size from config (in bytes)"""
    return config.advanced.max_file_size


def get_default_storage_tier(config: S3StrataConfig) -> StorageTier:
    """Get default storage tier from config"""
    return config.advanced.default_storage_tier


def get_default_visibility(config: S3StrataConfig) -> FileVisibility:
    """Get default visibility from config"""
    return config.advanced.default_visibility
