# S3Strata Python

Object storage abstraction layer with dual-bucket tiered storage and visibility control for Python.

This is the Python version of [s3strata-ts](https://github.com/SiwatINC/s3strata), providing the same functionality and **compatible metadata storage format**.

## Features

- **Dual-bucket tiered storage**: Separate HOT (frequently accessed) and COLD (archived) storage tiers
- **Visibility control**: PUBLIC (direct URL access) vs PRIVATE (presigned URL)
- **Multi-endpoint support**: Use different S3 endpoints for each tier
- **Hot storage expiration**: Automatic archival of expired HOT files
- **Orphan management**: Detect and manage S3 objects without database records
- **Database agnostic**: Bring your own database via the `StorageAdapter` interface
- **Async/await support**: Built for modern async Python applications
- **Compatible with TypeScript version**: Same metadata format, interoperable storage

## Installation

```bash
pip install s3strata
```

For SQLAlchemy support:
```bash
pip install s3strata[sqlalchemy]
```

## Quick Start

```python
import asyncio
from s3strata import FileManager, S3StrataConfig, StorageAdapter, PhysicalFile
from datetime import datetime
from typing import List, Optional

# Implement your storage adapter (example with in-memory storage)
class InMemoryAdapter(StorageAdapter):
    def __init__(self):
        self.files = {}
        self.next_id = 1
    
    async def create(self, storage_tier, filename, path, hot_until):
        file_id = self.next_id
        self.next_id += 1
        file = PhysicalFile(
            id=file_id,
            storage_tier=storage_tier,
            filename=filename,
            path=path,
            hot_until=hot_until,
            created_at=datetime.now(),
        )
        self.files[file_id] = file
        return file
    
    async def find_by_id(self, id):
        return self.files.get(id)
    
    async def update(self, id, storage_tier=None, path=None, hot_until=None):
        file = self.files[id]
        if storage_tier is not None:
            file.storage_tier = storage_tier
        if path is not None:
            file.path = path
        if hot_until is not None:
            file.hot_until = hot_until
        return file
    
    async def delete(self, id):
        del self.files[id]
    
    async def find_expired_hot_files(self):
        now = datetime.now()
        return [f for f in self.files.values() 
                if f.storage_tier == "HOT" and f.hot_until and f.hot_until <= now]
    
    async def find_all(self):
        return list(self.files.values())


async def main():
    # Configure S3Strata
    config = S3StrataConfig(
        endpoint="s3.amazonaws.com",
        access_key="your-access-key",
        secret_key="your-secret-key",
        hot_bucket="my-hot-bucket",
        cold_bucket="my-cold-bucket",
    )
    
    # Create file manager with your adapter
    adapter = InMemoryAdapter()
    file_manager = FileManager(config, adapter)
    
    # Upload a file
    file = await file_manager.upload(
        b"Hello, World!",
        UploadOptions(filename="hello.txt")
    )
    
    # Get URL for the file
    url = await file_manager.get_url(file)
    print(f"File URL: {url}")
    
    # Archive expired hot files (housekeeping)
    archived_count = await file_manager.archive_expired_hot_files()
    print(f"Archived {archived_count} files")

if __name__ == "__main__":
    asyncio.run(main())
```

## Configuration

### Shared Endpoint Mode

Use the same S3 endpoint and credentials for both tiers:

```python
config = S3StrataConfig(
    endpoint="s3.amazonaws.com",
    access_key="your-access-key",
    secret_key="your-secret-key",
    hot_bucket="my-hot-bucket",
    cold_bucket="my-cold-bucket",
)
```

### Separate Endpoint Mode

Use different endpoints for each tier (e.g., MinIO for HOT, AWS S3 for COLD):

```python
from s3strata import S3TierConfig

config = S3StrataConfig(
    hot=S3TierConfig(
        endpoint="localhost",
        port=9000,
        use_ssl=False,
        access_key="minioadmin",
        secret_key="minioadmin",
        bucket="hot-bucket",
    ),
    cold=S3TierConfig(
        endpoint="s3.amazonaws.com",
        access_key="aws-access-key",
        secret_key="aws-secret-key",
        bucket="cold-bucket",
    ),
)
```

## Storage Adapter

Implement the `StorageAdapter` interface to integrate with your database:

```python
from s3strata import StorageAdapter, PhysicalFile, StorageTier
from datetime import datetime
from typing import List, Optional, Union

class MyDatabaseAdapter(StorageAdapter):
    async def create(
        self,
        storage_tier: StorageTier,
        filename: str,
        path: str,
        hot_until: Optional[datetime],
    ) -> PhysicalFile:
        # Create record in your database
        pass
    
    async def find_by_id(self, id: Union[str, int]) -> Optional[PhysicalFile]:
        # Find record by ID
        pass
    
    async def update(
        self,
        id: Union[str, int],
        storage_tier: Optional[StorageTier] = None,
        path: Optional[str] = None,
        hot_until: Optional[datetime] = None,
    ) -> PhysicalFile:
        # Update record
        pass
    
    async def delete(self, id: Union[str, int]) -> None:
        # Delete record
        pass
    
    async def find_expired_hot_files(self) -> List[PhysicalFile]:
        # Find HOT files where hot_until has passed
        pass
    
    async def find_all(self) -> List[PhysicalFile]:
        # Return all files
        pass
```

See [examples/sqlalchemy_adapter.py](examples/sqlalchemy_adapter.py) for a complete SQLAlchemy implementation.

## API Reference

### FileManager

Main service for file operations.

```python
# Upload file
file = await file_manager.upload(data: bytes, options: UploadOptions)

# Get URL (public or presigned)
url = await file_manager.get_url(file: PhysicalFile, options: GetUrlOptions)

# Change visibility
file = await file_manager.set_visibility(file: PhysicalFile, options: SetVisibilityOptions)

# Change storage tier
file = await file_manager.set_tier(file: PhysicalFile, options: SetTierOptions)

# Delete file
await file_manager.delete(file: PhysicalFile)

# Get file by ID
file = await file_manager.get_by_id(id: str | int)

# Check if file exists in S3
exists = await file_manager.exists(file: PhysicalFile)

# Set hot storage duration
file = await file_manager.set_hot_duration(file: PhysicalFile, options: SetHotDurationOptions)

# Archive expired hot files
count = await file_manager.archive_expired_hot_files()

# List all files from database
files = await file_manager.list_files()

# List all S3 objects
objects = await file_manager.list_all_objects(prefix: Optional[str])

# List orphan objects
orphans = await file_manager.list_orphan_objects(prefix: Optional[str])

# Delete orphan objects
result = await file_manager.delete_orphan_objects(options: DeleteOrphanOptions)

# Adopt orphan objects
result = await file_manager.adopt_orphan_objects(options: AdoptOrphanOptions)
```

## Compatibility with TypeScript Version

This Python implementation is designed to be fully compatible with the TypeScript version:

- Same metadata format and field names
- Same storage tier enumeration (HOT/COLD)
- Same visibility levels (PUBLIC/PRIVATE)
- Same path structure in S3 buckets
- Same PhysicalFile interface

You can use both versions interchangeably with the same S3 buckets and database.

## Development

### Setup

```bash
# Install with dev dependencies
pip install -e ".[dev]"
```

### Linting and Formatting

```bash
# Run linter
make lint
# or
ruff check s3strata examples

# Auto-fix linting issues
ruff check --fix s3strata examples

# Format code
make format
# or
black s3strata examples

# Type checking
make typecheck
# or
mypy s3strata

# Run all checks
make check
```

## License

MIT

## Repository

https://github.com/SiwatINC/s3strata
