# S3Strata

Object storage abstraction layer with dual-bucket tiered storage and visibility control for Bun/TypeScript.

## Features

- **Dual-Bucket Architecture**: Abstracts HOT (SSD) and COLD (HDD) storage tiers
- **Multi-Endpoint Support**: Use different S3 providers/regions for each tier (e.g., AWS S3 for HOT, Backblaze B2 for COLD)
- **Visibility Control**: PUBLIC and PRIVATE file access with path-based separation
- **Smart URL Generation**: Direct URLs for public files, presigned URLs for private files
- **Hot Storage Duration**: Set time-based expiration for files in HOT storage with automatic archival to COLD
- **Type-safe**: Full TypeScript support
- **Database Agnostic**: Pluggable storage adapter interface - bring your own ORM/database
- **Lateral Movement**: Easy migration between storage tiers and visibility levels
- **Automatic Archival**: Housekeeping method to periodically move expired HOT files to COLD storage

## Installation

```bash
npm install s3strata
# or
bun add s3strata
```

## Architecture

### Storage Tiers
- **HOT**: Fast SSD storage for frequently accessed files
- **COLD**: Cost-effective HDD storage for archival/infrequent access

### File Visibility
- **PUBLIC**: Publicly accessible files with `/public` prefix
  - Returns direct URLs without presigning
  - Example: `https://s3.example.com/hot-bucket/public/images/uuid.jpg`
- **PRIVATE**: Protected files with `/private` prefix
  - Returns presigned URLs (default 4-hour expiration)
  - Example: Presigned URL to `/hot-bucket/private/submissions/uuid.pdf`

### Hot Storage Duration
Files in HOT storage can be flagged with an expiration time (`hot_until`). When the expiration time is reached, files can be automatically archived to COLD storage using the housekeeping method.

- **Permanent HOT**: Files with `hot_until = null` stay in HOT storage indefinitely
- **Temporary HOT**: Files with `hot_until = <date>` are marked for archival after that date
- **Immediate archival**: Set `duration = 0` to mark for immediate archival

### Path Structure
```
{bucket}/{visibility}/{custom-path}
├── hot-bucket/
│   ├── public/       # Publicly accessible HOT files
│   └── private/      # Protected HOT files
└── cold-bucket/
    ├── public/       # Publicly accessible COLD files
    └── private/      # Protected COLD files
```

## Quick Start

### 1. Implement a Storage Adapter

S3Strata is database-agnostic. You need to implement the `StorageAdapter` interface to connect to your database:

```typescript
import type { StorageAdapter, PhysicalFile, StorageTier } from 's3strata';

class MyStorageAdapter implements StorageAdapter {
  async create(data: {
    storage_tier: StorageTier;
    filename: string;
    path: string;
    hot_until: Date | null;
  }): Promise<PhysicalFile> {
    // Implement: Create a new file record in your database
  }

  async findById(id: string | number): Promise<PhysicalFile | null> {
    // Implement: Find a file by ID
  }

  async update(
    id: string | number,
    data: {
      storage_tier?: StorageTier;
      path?: string;
      hot_until?: Date | null;
    }
  ): Promise<PhysicalFile> {
    // Implement: Update a file record
  }

  async delete(id: string | number): Promise<void> {
    // Implement: Delete a file record
  }

  async findExpiredHotFiles(): Promise<PhysicalFile[]> {
    // Implement: Find HOT files where hot_until <= now
  }
}
```

See [examples/prisma-adapter.ts](src/examples/prisma-adapter.ts) for a complete Prisma implementation example.

### 2. Initialize FileManager

S3Strata supports two configuration modes:

**Option A: Shared Endpoint (same S3 provider for both tiers)**

```typescript
import { FileManager, StorageTier, FileVisibility } from 's3strata';
import type { S3StrataConfig } from 's3strata';

// Configure S3 connection
const config: S3StrataConfig = {
  endpoint: 's3.amazonaws.com',
  port: 443,
  useSSL: true,
  accessKey: 'YOUR_ACCESS_KEY',
  secretKey: 'YOUR_SECRET_KEY',
  hotBucket: 'my-hot-bucket',
  coldBucket: 'my-cold-bucket',
  // Advanced options (optional)
  advanced: {
    defaultPresignedUrlExpiration: 7200, // 2 hours (default: 14400 = 4 hours)
    maxFileSize: 500 * 1024 * 1024, // 500MB (default: Infinity = no limit)
    defaultStorageTier: StorageTier.HOT, // default: StorageTier.HOT
    defaultVisibility: FileVisibility.PRIVATE, // default: FileVisibility.PRIVATE
  },
};

// Create your storage adapter instance
const adapter = new MyStorageAdapter(/* ... */);

// Create FileManager instance
const fileManager = new FileManager(config, adapter);
```

**Option B: Separate Endpoints (different S3 providers for each tier)**

Perfect for cost optimization - use expensive fast storage for HOT, cheap archival for COLD:

```typescript
const config: S3StrataConfig = {
  // HOT storage on AWS S3 (fast, expensive)
  hot: {
    endpoint: 's3.us-east-1.amazonaws.com',
    accessKey: 'AWS_ACCESS_KEY',
    secretKey: 'AWS_SECRET_KEY',
    bucket: 'my-hot-bucket',
  },
  // COLD storage on Backblaze B2 (slower, 77% cheaper)
  cold: {
    endpoint: 's3.us-west-004.backblazeb2.com',
    accessKey: 'B2_ACCESS_KEY',
    secretKey: 'B2_SECRET_KEY',
    bucket: 'my-archive-bucket',
  },
};

const fileManager = new FileManager(config, adapter);
```

See [MULTI_ENDPOINT.md](MULTI_ENDPOINT.md) for detailed multi-endpoint configuration guide.

### Advanced Configuration Options

S3Strata allows you to customize default behaviors through the `advanced` configuration object:

```typescript
const config: S3StrataConfig = {
  // ... your S3 configuration ...
  advanced: {
    // Default expiration time for presigned URLs in seconds
    // Default: 14400 (4 hours)
    defaultPresignedUrlExpiration: 3600, // 1 hour

    // Maximum allowed file size in bytes
    // Default: Infinity (no limit)
    maxFileSize: 100 * 1024 * 1024, // 100MB

    // Default storage tier for new files
    // Default: StorageTier.HOT
    defaultStorageTier: StorageTier.HOT,

    // Default visibility for new files
    // Default: FileVisibility.PRIVATE
    defaultVisibility: FileVisibility.PRIVATE,
  },
};
```

**When to use advanced options:**
- Set `maxFileSize` to enforce upload limits and prevent abuse
- Customize `defaultPresignedUrlExpiration` based on your security requirements
- Change `defaultStorageTier` if you want new uploads to go to COLD storage by default
- Set `defaultVisibility` to PUBLIC if most of your files should be publicly accessible

All advanced options are optional and have sensible defaults. You can override defaults on a per-operation basis (e.g., specify `expiresIn` when calling `getUrl()`).

### 3. Use FileManager

```typescript
// Upload a private file to HOT storage
const file = await fileManager.upload(buffer, {
  tier: StorageTier.HOT,
  visibility: FileVisibility.PRIVATE,
  filename: 'document.pdf',
});

// Get URL (returns presigned URL for private files)
const url = await fileManager.getUrl(file, {
  expiresIn: 14400, // 4 hours (default)
});

// Make file public (moves from /private to /public)
const updatedFile = await fileManager.setVisibility(file, {
  visibility: FileVisibility.PUBLIC,
});

// Get URL (now returns direct public URL)
const publicUrl = await fileManager.getUrl(updatedFile);

// Move to COLD storage (migrates to HDD bucket)
const coldFile = await fileManager.setTier(updatedFile, {
  tier: StorageTier.COLD,
});

// Delete file
await fileManager.delete(coldFile);
```

## API Reference

### FileManager

#### `upload(data: Buffer | Blob, options?: UploadOptions): Promise<PhysicalFile>`

Upload a file to object storage.

**Options:**
- `tier?: StorageTier` - Storage tier (HOT or COLD), defaults to HOT
- `visibility?: FileVisibility` - File visibility (PUBLIC or PRIVATE), defaults to PRIVATE
- `filename?: string` - Custom filename (optional, auto-generated if not provided)
- `pathSuffix?: string` - Custom path suffix (optional, auto-generated if not provided)
- `hotDuration?: number` - Duration in seconds to keep file in HOT storage (only for HOT tier)

**Example:**
```typescript
const file = await fileManager.upload(buffer, {
  tier: StorageTier.HOT,
  visibility: FileVisibility.PRIVATE,
  filename: 'report.pdf',
  hotDuration: 7 * 24 * 60 * 60, // 7 days
});
```

#### `getUrl(file: PhysicalFile, options?: GetUrlOptions): Promise<string>`

Generate URL for a file. Returns direct URL for PUBLIC files, presigned URL for PRIVATE files.

**Options:**
- `expiresIn?: number` - Presign duration in seconds (default: 14400 = 4 hours), only used for PRIVATE files

**Example:**
```typescript
const url = await fileManager.getUrl(file, { expiresIn: 3600 }); // 1 hour
```

#### `setVisibility(file: PhysicalFile, options: SetVisibilityOptions): Promise<PhysicalFile>`

Change file visibility (PUBLIC ↔ PRIVATE). Moves file between `/public` and `/private` prefixes.

**Options:**
- `visibility: FileVisibility` - New visibility level
- `moveFile?: boolean` - Whether to move the file immediately (default: true)

**Example:**
```typescript
const publicFile = await fileManager.setVisibility(file, {
  visibility: FileVisibility.PUBLIC,
});
```

#### `setTier(file: PhysicalFile, options: SetTierOptions): Promise<PhysicalFile>`

Move file between storage tiers (HOT ↔ COLD).

**Options:**
- `tier: StorageTier` - New storage tier
- `moveFile?: boolean` - Whether to move the file immediately (default: true)
- `hotDuration?: number` - Duration in seconds to keep file in HOT storage (only when tier=HOT)

**Example:**
```typescript
const coldFile = await fileManager.setTier(file, {
  tier: StorageTier.COLD,
});
```

#### `setHotDuration(file: PhysicalFile, options: SetHotDurationOptions): Promise<PhysicalFile>`

Set hot storage duration for a HOT tier file.

**Options:**
- `duration: number | null` - Duration in seconds (null = permanent, 0 = immediate archival)

**Example:**
```typescript
// Set 30-day expiration
const updated = await fileManager.setHotDuration(file, {
  duration: 30 * 24 * 60 * 60,
});

// Make permanent (remove expiration)
const permanent = await fileManager.setHotDuration(file, {
  duration: null,
});

// Mark for immediate archival
const immediate = await fileManager.setHotDuration(file, {
  duration: 0,
});
```

#### `delete(file: PhysicalFile): Promise<void>`

Delete a file from both storage and database.

**Example:**
```typescript
await fileManager.delete(file);
```

#### `getById(id: string | number): Promise<PhysicalFile | null>`

Get file record from database by ID.

**Example:**
```typescript
const file = await fileManager.getById(123);
```

#### `exists(file: PhysicalFile): Promise<boolean>`

Check if file exists in object storage.

**Example:**
```typescript
const exists = await fileManager.exists(file);
```

#### `archiveExpiredHotFiles(): Promise<number>`

Housekeeping method to move expired HOT files to COLD storage. Returns the number of files moved.

**Example:**
```typescript
// Run periodically via cron job
const movedCount = await fileManager.archiveExpiredHotFiles();
console.log(`Archived ${movedCount} files from HOT to COLD`);
```

#### `listFiles(): Promise<PhysicalFile[]>`

List all file records from the database.

**Example:**
```typescript
const allFiles = await fileManager.listFiles();
console.log(allFiles);
```

## Storage Adapter Examples

### Prisma Adapter

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaStorageAdapter } from 's3strata';

const prisma = new PrismaClient();
const adapter = new PrismaStorageAdapter(prisma);
const fileManager = new FileManager(config, adapter);
```

**Prisma Schema:**
```prisma
model PhysicalFile {
  id           Int          @id @default(autoincrement())
  storage_tier StorageTier
  filename     String
  path         String
  hot_until    DateTime?
  created_at   DateTime     @default(now())
  updated_at   DateTime     @updatedAt
}

enum StorageTier {
  HOT
  COLD
}
```

### Custom Adapter Example

```typescript
import type { StorageAdapter, PhysicalFile, StorageTier } from 's3strata';
import { Database } from 'some-database-library';

class CustomStorageAdapter implements StorageAdapter {
  constructor(private db: Database) {}

  async create(data: {
    storage_tier: StorageTier;
    filename: string;
    path: string;
    hot_until: Date | null;
  }): Promise<PhysicalFile> {
    const result = await this.db.insert('physical_files', data);
    return result;
  }

  async findById(id: string | number): Promise<PhysicalFile | null> {
    return await this.db.findOne('physical_files', { id });
  }

  async update(
    id: string | number,
    data: {
      storage_tier?: StorageTier;
      path?: string;
      hot_until?: Date | null;
    }
  ): Promise<PhysicalFile> {
    return await this.db.update('physical_files', { id }, data);
  }

  async delete(id: string | number): Promise<void> {
    await this.db.delete('physical_files', { id });
  }

  async findExpiredHotFiles(): Promise<PhysicalFile[]> {
    return await this.db.findMany('physical_files', {
      storage_tier: 'HOT',
      hot_until: { lte: new Date() },
    });
  }
}
```

## Complete Usage Example

```typescript
import { FileManager, StorageTier, FileVisibility, PrismaStorageAdapter } from 's3strata';
import { PrismaClient } from '@prisma/client';

// Initialize
const prisma = new PrismaClient();
const adapter = new PrismaStorageAdapter(prisma);
const config = {
  endpoint: 's3.amazonaws.com',
  accessKey: process.env.S3_ACCESS_KEY!,
  secretKey: process.env.S3_SECRET_KEY!,
  hotBucket: 'my-hot-bucket',
  coldBucket: 'my-cold-bucket',
};
const fileManager = new FileManager(config, adapter);

// Upload a file with 7-day hot storage
const file = await fileManager.upload(fileBuffer, {
  tier: StorageTier.HOT,
  visibility: FileVisibility.PRIVATE,
  filename: 'user-upload.pdf',
  hotDuration: 7 * 24 * 60 * 60, // 7 days
});

// Get presigned URL (4 hour expiration)
const url = await fileManager.getUrl(file);

// After processing, make it public
const publicFile = await fileManager.setVisibility(file, {
  visibility: FileVisibility.PUBLIC,
});

// Get public URL
const publicUrl = await fileManager.getUrl(publicFile);

// Move to cold storage for long-term archival
const archivedFile = await fileManager.setTier(publicFile, {
  tier: StorageTier.COLD,
});

// Run housekeeping (e.g., in a cron job)
setInterval(async () => {
  const count = await fileManager.archiveExpiredHotFiles();
  console.log(`Archived ${count} expired files`);
}, 60 * 60 * 1000); // Every hour
```

## Environment Variables

You can use environment variables for configuration:

```bash
S3_ENDPOINT=s3.amazonaws.com
S3_PORT=443
S3_USE_SSL=true
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_HOT=hot-bucket
S3_BUCKET_COLD=cold-bucket
```

## TypeScript Support

S3Strata is written in TypeScript and provides full type definitions.

```typescript
import type {
  PhysicalFile,
  StorageAdapter,
  S3StrataConfig,
  S3StrataAdvancedOptions,
  UploadOptions,
  GetUrlOptions,
  SetVisibilityOptions,
  SetTierOptions,
} from 's3strata';
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
