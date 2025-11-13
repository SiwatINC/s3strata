"""Tests for s3strata config"""

import pytest

from s3strata.config import (
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
from s3strata.types import FileVisibility, StorageTier


def test_advanced_options_defaults():
    """Test S3StrataAdvancedOptions default values"""
    options = S3StrataAdvancedOptions()

    assert options.default_presigned_url_expiration == 14400
    assert options.max_file_size == float("inf")
    assert options.default_storage_tier == StorageTier.HOT
    assert options.default_visibility == FileVisibility.PRIVATE


def test_advanced_options_custom():
    """Test S3StrataAdvancedOptions with custom values"""
    options = S3StrataAdvancedOptions(
        default_presigned_url_expiration=7200,
        max_file_size=1024 * 1024 * 10,  # 10MB
        default_storage_tier=StorageTier.COLD,
        default_visibility=FileVisibility.PUBLIC,
    )

    assert options.default_presigned_url_expiration == 7200
    assert options.max_file_size == 1024 * 1024 * 10
    assert options.default_storage_tier == StorageTier.COLD
    assert options.default_visibility == FileVisibility.PUBLIC


def test_tier_config():
    """Test S3TierConfig"""
    config = S3TierConfig(
        endpoint="s3.example.com",
        access_key="test-key",
        secret_key="test-secret",
        bucket="test-bucket",
        port=9000,
        use_ssl=False,
        public_prefix="pub",
        private_prefix="priv",
    )

    assert config.endpoint == "s3.example.com"
    assert config.access_key == "test-key"
    assert config.secret_key == "test-secret"
    assert config.bucket == "test-bucket"
    assert config.port == 9000
    assert config.use_ssl is False
    assert config.public_prefix == "pub"
    assert config.private_prefix == "priv"


def test_tier_config_defaults():
    """Test S3TierConfig default values"""
    config = S3TierConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
        bucket="bucket",
    )

    assert config.port == 443
    assert config.use_ssl is True
    assert config.public_prefix == "public"
    assert config.private_prefix == "private"


def test_shared_config_mode():
    """Test S3StrataConfig in shared endpoint mode"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        port=9000,
        use_ssl=True,
        access_key="test-key",
        secret_key="test-secret",
        hot_bucket="hot-bucket",
        cold_bucket="cold-bucket",
    )

    assert config.endpoint == "s3.example.com"
    assert config.port == 9000
    assert config.hot_bucket == "hot-bucket"
    assert config.cold_bucket == "cold-bucket"


def test_separate_config_mode():
    """Test S3StrataConfig in separate endpoint mode"""
    hot_config = S3TierConfig(
        endpoint="hot.s3.example.com",
        access_key="hot-key",
        secret_key="hot-secret",
        bucket="hot-bucket",
    )

    cold_config = S3TierConfig(
        endpoint="cold.s3.example.com",
        access_key="cold-key",
        secret_key="cold-secret",
        bucket="cold-bucket",
    )

    config = S3StrataConfig(hot=hot_config, cold=cold_config)

    assert config.hot == hot_config
    assert config.cold == cold_config


def test_get_tier_config_separate_mode():
    """Test get_tier_config with separate endpoint configs"""
    hot_config = S3TierConfig(
        endpoint="hot.example.com",
        access_key="hot-key",
        secret_key="hot-secret",
        bucket="hot-bucket",
    )

    cold_config = S3TierConfig(
        endpoint="cold.example.com",
        access_key="cold-key",
        secret_key="cold-secret",
        bucket="cold-bucket",
    )

    config = S3StrataConfig(hot=hot_config, cold=cold_config)

    hot_result = get_tier_config(config, StorageTier.HOT)
    assert hot_result == hot_config

    cold_result = get_tier_config(config, StorageTier.COLD)
    assert cold_result == cold_config


def test_get_tier_config_shared_mode():
    """Test get_tier_config with shared endpoint config"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        port=9000,
        use_ssl=False,
        access_key="shared-key",
        secret_key="shared-secret",
        hot_bucket="hot-bucket",
        cold_bucket="cold-bucket",
        public_hot_prefix="hot-public",
        private_hot_prefix="hot-private",
        public_cold_prefix="cold-public",
        private_cold_prefix="cold-private",
    )

    hot_result = get_tier_config(config, StorageTier.HOT)
    assert hot_result.endpoint == "s3.example.com"
    assert hot_result.port == 9000
    assert hot_result.use_ssl is False
    assert hot_result.bucket == "hot-bucket"
    assert hot_result.public_prefix == "hot-public"
    assert hot_result.private_prefix == "hot-private"

    cold_result = get_tier_config(config, StorageTier.COLD)
    assert cold_result.endpoint == "s3.example.com"
    assert cold_result.port == 9000
    assert cold_result.use_ssl is False
    assert cold_result.bucket == "cold-bucket"
    assert cold_result.public_prefix == "cold-public"
    assert cold_result.private_prefix == "cold-private"


def test_get_tier_config_missing_shared_config():
    """Test get_tier_config raises error when shared config is incomplete"""
    config = S3StrataConfig()

    with pytest.raises(ValueError, match="Missing S3 configuration"):
        get_tier_config(config, StorageTier.HOT)


def test_get_tier_config_missing_bucket():
    """Test get_tier_config raises error when bucket is missing"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
    )

    with pytest.raises(ValueError, match="Missing bucket configuration"):
        get_tier_config(config, StorageTier.HOT)


def test_get_bucket_name():
    """Test get_bucket_name helper"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
        hot_bucket="hot-bucket",
        cold_bucket="cold-bucket",
    )

    assert get_bucket_name(config, StorageTier.HOT) == "hot-bucket"
    assert get_bucket_name(config, StorageTier.COLD) == "cold-bucket"


def test_get_path_prefix():
    """Test get_path_prefix helper"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
        hot_bucket="hot-bucket",
        cold_bucket="cold-bucket",
        public_hot_prefix="pub-hot",
        private_hot_prefix="priv-hot",
    )

    hot_public = get_path_prefix(config, StorageTier.HOT, FileVisibility.PUBLIC)
    assert hot_public == "pub-hot"

    hot_private = get_path_prefix(config, StorageTier.HOT, FileVisibility.PRIVATE)
    assert hot_private == "priv-hot"

    # Cold should use default prefixes
    cold_public = get_path_prefix(config, StorageTier.COLD, FileVisibility.PUBLIC)
    assert cold_public == "public"

    cold_private = get_path_prefix(config, StorageTier.COLD, FileVisibility.PRIVATE)
    assert cold_private == "private"


def test_get_default_presigned_url_expiration():
    """Test get_default_presigned_url_expiration helper"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
        hot_bucket="hot",
        cold_bucket="cold",
        advanced=S3StrataAdvancedOptions(default_presigned_url_expiration=3600),
    )

    assert get_default_presigned_url_expiration(config) == 3600


def test_get_max_file_size():
    """Test get_max_file_size helper"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
        hot_bucket="hot",
        cold_bucket="cold",
        advanced=S3StrataAdvancedOptions(max_file_size=1024 * 1024 * 5),
    )

    assert get_max_file_size(config) == 1024 * 1024 * 5


def test_get_default_storage_tier():
    """Test get_default_storage_tier helper"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
        hot_bucket="hot",
        cold_bucket="cold",
        advanced=S3StrataAdvancedOptions(default_storage_tier=StorageTier.COLD),
    )

    assert get_default_storage_tier(config) == StorageTier.COLD


def test_get_default_visibility():
    """Test get_default_visibility helper"""
    config = S3StrataConfig(
        endpoint="s3.example.com",
        access_key="key",
        secret_key="secret",
        hot_bucket="hot",
        cold_bucket="cold",
        advanced=S3StrataAdvancedOptions(default_visibility=FileVisibility.PUBLIC),
    )

    assert get_default_visibility(config) == FileVisibility.PUBLIC
