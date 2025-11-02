# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
