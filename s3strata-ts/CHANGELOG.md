# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2025-11-03

### Fixed

- **S3 Endpoint Configuration**: Fixed S3 signature errors by properly handling endpoint URLs with standard and non-standard ports
  - Standard ports (80 for HTTP, 443 for HTTPS) are now excluded from the endpoint URL
  - Non-standard ports are correctly included in the endpoint URL (e.g., `http://localhost:9000`)
  - Resolves "SignatureDoesNotMatch" errors when connecting to S3-compatible services
  - Improves compatibility with MinIO and other S3-compatible storage providers

## [1.4.0] - 2025-11-03

### Added

- **Prisma Compatibility**: `PhysicalFile.storage_tier` now accepts string literals `"HOT" | "COLD"` in addition to the `StorageTier` enum
  - Fixes type incompatibility issues when using Prisma-generated enum types
  - No breaking changes - existing code using `StorageTier` enum continues to work
- New utility functions for storage tier validation:
  - `normalizeStorageTier(tier)`: Converts string literals to `StorageTier` enum
  - `isValidStorageTier(value)`: Type guard to validate storage tier values

### Changed

- `FileManager` methods now internally normalize `storage_tier` values for consistent behavior
- All file operations accept both enum and string literal values seamlessly

### Fixed

- Type error when passing Prisma-generated `PhysicalFile` objects to `FileManager` methods

## [1.3.0] - 2025-11-03

### Added

- **Advanced Configuration Options**: New `advanced` object in `S3StrataConfig` to customize default behaviors
  - `defaultPresignedUrlExpiration`: Customize default presigned URL expiration time (default: 14400 = 4 hours)
  - `maxFileSize`: Set maximum allowed file size in bytes (default: Infinity = no limit)
  - `defaultStorageTier`: Configure default storage tier for uploads (default: StorageTier.HOT)
  - `defaultVisibility`: Set default visibility for new files (default: FileVisibility.PRIVATE)
- New `S3StrataAdvancedOptions` interface for type-safe configuration
- Helper functions to access configured values:
  - `getDefaultPresignedUrlExpiration(config)`
  - `getMaxFileSize(config)`
  - `getDefaultStorageTier(config)`
  - `getDefaultVisibility(config)`

### Changed

- `FileManager` now uses configurable defaults instead of hardcoded constants
- Default `maxFileSize` changed from 100MB to Infinity (no limit) - use `advanced.maxFileSize` to set limits
- All hardcoded constants now have configurable alternatives via `advanced` options

### Documentation

- Updated README with Advanced Configuration Options section
- Added examples demonstrating the use of advanced configuration
- Updated TypeScript type exports to include `S3StrataAdvancedOptions`

## [1.2.0] - 2025-11-03

### Added

- `listFiles()` method to `FileManager` to retrieve all file records from the database.

### Changed

- `StorageAdapter` interface updated with a new `findAll()` method.

### Fixed

- Corrected Bun's `S3Client` configuration for improved compatibility with S3-compatible services like MinIO.
- Fixed the `exists()` method to accurately report file existence in the object store.

## [1.1.0] - 2025-11-03

### Added

- **Multi-Endpoint Support**: Configure different S3 endpoints and credentials for HOT and COLD tiers
  - Use different S3 providers (e.g., AWS S3 for HOT, Backblaze B2 for COLD)
  - Support for different regions per tier
  - Backward compatible with shared endpoint configuration
- New `S3TierConfig` interface for tier-specific configuration
- `getTierConfig()` helper function to resolve tier configuration
- Comprehensive MULTI_ENDPOINT.md guide with use cases and examples
- Example configurations for AWS S3 + Backblaze B2, AWS S3 + Wasabi, and more

### Changed

- `S3StrataConfig` now supports both shared and separate endpoint modes
- `ObjectStoreService` updated to handle different endpoints per tier
- All tier-specific operations now respect per-tier endpoint configuration

### Documentation Updates

- Updated README with multi-endpoint configuration examples
- Added MULTI_ENDPOINT.md with detailed use cases and cost comparisons
- Updated usage examples to demonstrate both configuration modes

## [1.0.0] - 2025-11-02

### Added

- Initial release of S3Strata
- Dual-bucket architecture (HOT/COLD storage tiers)
- File visibility control (PUBLIC/PRIVATE)
- Smart URL generation (direct URLs for public, presigned for private)
- Hot storage duration with automatic archival
- Database-agnostic design via StorageAdapter interface
- `ObjectStoreService` for low-level S3 operations
- `FileManager` for high-level file management
- `PrismaStorageAdapter` example implementation
- Complete TypeScript type definitions
- Comprehensive documentation and examples

### Features

- Upload files to HOT or COLD storage
- Set file visibility (PUBLIC/PRIVATE)
- Generate URLs (direct or presigned)
- Move files between storage tiers
- Change file visibility
- Set hot storage duration with expiration
- Automatic archival of expired HOT files
- Delete files from storage and database
- Check file existence
- Full TypeScript support

### Documentation

- README with complete API documentation
- PRISMA_SETUP guide for Prisma users
- MIGRATION guide for upgrading from old package
- Usage examples (in-memory and Prisma)
- MIT License
