"""Tests for s3strata types"""

from datetime import datetime

from s3strata.types import (
    FileVisibility,
    PhysicalFile,
    StorageTier,
    UploadOptions,
    GetUrlOptions,
    SetVisibilityOptions,
    SetTierOptions,
    SetHotDurationOptions,
    S3Object,
    OrphanObject,
    BucketObjects,
    AllBucketObjects,
    DeleteOrphanOptions,
    DeleteOrphanResult,
    AdoptOrphanOptions,
    AdoptOrphanResult,
)


def test_storage_tier_enum():
    """Test StorageTier enum values"""
    assert StorageTier.HOT == "HOT"
    assert StorageTier.COLD == "COLD"
    assert StorageTier.HOT.value == "HOT"
    assert StorageTier.COLD.value == "COLD"


def test_file_visibility_enum():
    """Test FileVisibility enum values"""
    assert FileVisibility.PUBLIC == "PUBLIC"
    assert FileVisibility.PRIVATE == "PRIVATE"
    assert FileVisibility.PUBLIC.value == "PUBLIC"
    assert FileVisibility.PRIVATE.value == "PRIVATE"


def test_physical_file():
    """Test PhysicalFile dataclass"""
    now = datetime.now()
    file = PhysicalFile(
        id="test-id",
        storage_tier=StorageTier.HOT,
        filename="test.txt",
        path="public/test.txt",
        hot_until=now,
        created_at=now,
        updated_at=now,
    )

    assert file.id == "test-id"
    assert file.storage_tier == StorageTier.HOT
    assert file.filename == "test.txt"
    assert file.path == "public/test.txt"
    assert file.hot_until == now
    assert file.created_at == now
    assert file.updated_at == now


def test_physical_file_with_string_tier():
    """Test PhysicalFile with string tier value"""
    file = PhysicalFile(
        id=1,
        storage_tier="HOT",
        filename="test.txt",
        path="private/test.txt",
        hot_until=None,
    )

    assert file.id == 1
    assert file.storage_tier == "HOT"
    assert file.filename == "test.txt"


def test_upload_options():
    """Test UploadOptions dataclass"""
    options = UploadOptions(
        tier=StorageTier.HOT,
        visibility=FileVisibility.PUBLIC,
        filename="test.txt",
        path_suffix="custom/path",
        hot_duration=3600,
    )

    assert options.tier == StorageTier.HOT
    assert options.visibility == FileVisibility.PUBLIC
    assert options.filename == "test.txt"
    assert options.path_suffix == "custom/path"
    assert options.hot_duration == 3600


def test_upload_options_defaults():
    """Test UploadOptions with default values"""
    options = UploadOptions()

    assert options.tier is None
    assert options.visibility is None
    assert options.filename is None
    assert options.path_suffix is None
    assert options.hot_duration is None


def test_get_url_options():
    """Test GetUrlOptions dataclass"""
    options = GetUrlOptions(expires_in=7200)
    assert options.expires_in == 7200

    options_default = GetUrlOptions()
    assert options_default.expires_in is None


def test_set_visibility_options():
    """Test SetVisibilityOptions dataclass"""
    options = SetVisibilityOptions(visibility=FileVisibility.PUBLIC, move_file=False)
    assert options.visibility == FileVisibility.PUBLIC
    assert options.move_file is False

    options_default = SetVisibilityOptions(visibility=FileVisibility.PRIVATE)
    assert options_default.visibility == FileVisibility.PRIVATE
    assert options_default.move_file is True


def test_set_tier_options():
    """Test SetTierOptions dataclass"""
    options = SetTierOptions(tier=StorageTier.COLD, move_file=False, hot_duration=1800)
    assert options.tier == StorageTier.COLD
    assert options.move_file is False
    assert options.hot_duration == 1800

    options_default = SetTierOptions(tier=StorageTier.HOT)
    assert options_default.tier == StorageTier.HOT
    assert options_default.move_file is True
    assert options_default.hot_duration is None


def test_set_hot_duration_options():
    """Test SetHotDurationOptions dataclass"""
    options = SetHotDurationOptions(duration=3600)
    assert options.duration == 3600

    options_clear = SetHotDurationOptions(duration=None)
    assert options_clear.duration is None


def test_s3_object():
    """Test S3Object dataclass"""
    now = datetime.now()
    obj = S3Object(
        key="test/file.txt",
        last_modified=now,
        size=1024,
        etag="abc123",
        storage_class="STANDARD",
    )

    assert obj.key == "test/file.txt"
    assert obj.last_modified == now
    assert obj.size == 1024
    assert obj.etag == "abc123"
    assert obj.storage_class == "STANDARD"


def test_orphan_object():
    """Test OrphanObject dataclass"""
    now = datetime.now()
    orphan = OrphanObject(
        key="orphan/file.txt",
        last_modified=now,
        size=2048,
        etag="def456",
        storage_class="GLACIER",
        tier=StorageTier.COLD,
        bucket="cold-bucket",
    )

    assert orphan.key == "orphan/file.txt"
    assert orphan.last_modified == now
    assert orphan.size == 2048
    assert orphan.tier == StorageTier.COLD
    assert orphan.bucket == "cold-bucket"


def test_bucket_objects():
    """Test BucketObjects dataclass"""
    now = datetime.now()
    objects = [
        S3Object(key="file1.txt", last_modified=now, size=100),
        S3Object(key="file2.txt", last_modified=now, size=200),
    ]

    bucket_objs = BucketObjects(
        tier=StorageTier.HOT,
        bucket="hot-bucket",
        objects=objects,
        count=2,
    )

    assert bucket_objs.tier == StorageTier.HOT
    assert bucket_objs.bucket == "hot-bucket"
    assert len(bucket_objs.objects) == 2
    assert bucket_objs.count == 2


def test_all_bucket_objects():
    """Test AllBucketObjects dataclass"""
    now = datetime.now()

    hot_bucket = BucketObjects(
        tier=StorageTier.HOT,
        bucket="hot-bucket",
        objects=[],
        count=0,
    )

    cold_bucket = BucketObjects(
        tier=StorageTier.COLD,
        bucket="cold-bucket",
        objects=[],
        count=0,
    )

    all_objects = AllBucketObjects(
        hot=hot_bucket,
        cold=cold_bucket,
        total_count=0,
        collected_at=now,
    )

    assert all_objects.hot == hot_bucket
    assert all_objects.cold == cold_bucket
    assert all_objects.total_count == 0
    assert all_objects.collected_at == now


def test_delete_orphan_options():
    """Test DeleteOrphanOptions dataclass"""
    options = DeleteOrphanOptions(prefix="test/", tier=StorageTier.HOT, dry_run=True)
    assert options.prefix == "test/"
    assert options.tier == StorageTier.HOT
    assert options.dry_run is True

    options_default = DeleteOrphanOptions()
    assert options_default.prefix is None
    assert options_default.tier is None
    assert options_default.dry_run is False


def test_delete_orphan_result():
    """Test DeleteOrphanResult dataclass"""
    result = DeleteOrphanResult(
        deleted=5,
        failed=1,
        deleted_paths=["path1", "path2"],
        errors=[{"path": "path3", "error": "Not found"}],
        dry_run=False,
    )

    assert result.deleted == 5
    assert result.failed == 1
    assert len(result.deleted_paths) == 2
    assert len(result.errors) == 1
    assert result.dry_run is False


def test_adopt_orphan_options():
    """Test AdoptOrphanOptions dataclass"""
    def custom_extractor(path: str) -> str:
        return path.split("/")[-1]

    options = AdoptOrphanOptions(
        prefix="orphans/",
        tier=StorageTier.COLD,
        extract_filename=custom_extractor,
        set_hot_until=True,
        hot_duration=7200,
    )

    assert options.prefix == "orphans/"
    assert options.tier == StorageTier.COLD
    assert options.extract_filename is not None
    assert options.extract_filename("path/to/file.txt") == "file.txt"
    assert options.set_hot_until is True
    assert options.hot_duration == 7200

    options_default = AdoptOrphanOptions()
    assert options_default.prefix is None
    assert options_default.tier is None
    assert options_default.extract_filename is None
    assert options_default.set_hot_until is False
    assert options_default.hot_duration is None


def test_adopt_orphan_result():
    """Test AdoptOrphanResult dataclass"""
    result = AdoptOrphanResult(
        adopted=10,
        failed=2,
        adopted_file_ids=["id1", "id2", 3],
        errors=[{"path": "error1", "error": "Failed"}],
    )

    assert result.adopted == 10
    assert result.failed == 2
    assert len(result.adopted_file_ids) == 3
    assert result.adopted_file_ids[2] == 3
    assert len(result.errors) == 1
