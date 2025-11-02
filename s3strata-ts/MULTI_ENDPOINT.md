# Multi-Endpoint Configuration Guide

S3Strata supports using different S3 endpoints for HOT and COLD storage tiers. This is useful for:

- **Cost optimization**: Use expensive fast storage (AWS S3) for HOT, cheap archival storage (Backblaze B2, Wasabi) for COLD
- **Geographic distribution**: HOT in one region, COLD in another
- **Provider diversity**: Mix different S3-compatible providers
- **Performance tuning**: Premium storage for HOT, standard for COLD

## Configuration Modes

### Mode 1: Shared Endpoint (Default)

Use the same S3 endpoint and credentials for both tiers:

```typescript
import { FileManager, StorageTier, FileVisibility } from 's3strata';
import type { S3StrataConfig } from 's3strata';

const config: S3StrataConfig = {
  endpoint: 's3.amazonaws.com',
  port: 443,
  useSSL: true,
  accessKey: 'YOUR_ACCESS_KEY',
  secretKey: 'YOUR_SECRET_KEY',
  hotBucket: 'my-hot-bucket',
  coldBucket: 'my-cold-bucket',
};

const fileManager = new FileManager(config, adapter);
```

### Mode 2: Separate Endpoints

Use different S3 endpoints and credentials for each tier:

```typescript
import { FileManager, StorageTier, FileVisibility } from 's3strata';
import type { S3StrataConfig } from 's3strata';

const config: S3StrataConfig = {
  hot: {
    endpoint: 's3.us-east-1.amazonaws.com',
    port: 443,
    useSSL: true,
    accessKey: 'AWS_ACCESS_KEY',
    secretKey: 'AWS_SECRET_KEY',
    bucket: 'fast-ssd-bucket',
  },
  cold: {
    endpoint: 's3.us-west-004.backblazeb2.com',
    port: 443,
    useSSL: true,
    accessKey: 'B2_ACCESS_KEY',
    secretKey: 'B2_SECRET_KEY',
    bucket: 'archive-bucket',
  },
};

const fileManager = new FileManager(config, adapter);
```

## Use Cases

### Use Case 1: AWS S3 (HOT) + Backblaze B2 (COLD)

Save costs by using Backblaze B2 for archival storage:

```typescript
const config: S3StrataConfig = {
  // HOT: AWS S3 for fast access
  hot: {
    endpoint: 's3.us-east-1.amazonaws.com',
    accessKey: process.env.AWS_ACCESS_KEY!,
    secretKey: process.env.AWS_SECRET_KEY!,
    bucket: 'my-app-hot-storage',
  },
  // COLD: Backblaze B2 for cheap archival (1/4 the cost of S3)
  cold: {
    endpoint: 's3.us-west-004.backblazeb2.com',
    accessKey: process.env.B2_ACCESS_KEY!,
    secretKey: process.env.B2_SECRET_KEY!,
    bucket: 'my-app-cold-archive',
  },
};
```

**Cost Comparison:**
- AWS S3: ~$0.023/GB/month
- Backblaze B2: ~$0.005/GB/month (77% cheaper)

### Use Case 2: AWS S3 (HOT) + Wasabi (COLD)

```typescript
const config: S3StrataConfig = {
  // HOT: AWS S3
  hot: {
    endpoint: 's3.amazonaws.com',
    accessKey: process.env.AWS_ACCESS_KEY!,
    secretKey: process.env.AWS_SECRET_KEY!,
    bucket: 'production-hot',
  },
  // COLD: Wasabi (no egress fees)
  cold: {
    endpoint: 's3.wasabisys.com',
    accessKey: process.env.WASABI_ACCESS_KEY!,
    secretKey: process.env.WASABI_SECRET_KEY!,
    bucket: 'production-cold',
  },
};
```

### Use Case 3: Different AWS Regions

```typescript
const config: S3StrataConfig = {
  // HOT: us-east-1 (close to users)
  hot: {
    endpoint: 's3.us-east-1.amazonaws.com',
    accessKey: process.env.AWS_ACCESS_KEY!,
    secretKey: process.env.AWS_SECRET_KEY!,
    bucket: 'app-hot-us-east-1',
  },
  // COLD: us-west-2 (backup region)
  cold: {
    endpoint: 's3.us-west-2.amazonaws.com',
    accessKey: process.env.AWS_ACCESS_KEY!,
    secretKey: process.env.AWS_SECRET_KEY!,
    bucket: 'app-cold-us-west-2',
  },
};
```

### Use Case 4: Self-Hosted MinIO (HOT) + Cloud (COLD)

```typescript
const config: S3StrataConfig = {
  // HOT: Self-hosted MinIO for fast local access
  hot: {
    endpoint: 'minio.mycompany.com',
    port: 9000,
    useSSL: true,
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
    bucket: 'hot-storage',
  },
  // COLD: AWS S3 Glacier for long-term archival
  cold: {
    endpoint: 's3.amazonaws.com',
    accessKey: process.env.AWS_ACCESS_KEY!,
    secretKey: process.env.AWS_SECRET_KEY!,
    bucket: 'glacier-archive',
  },
};
```

## Environment Variables

### Shared Endpoint Mode

```bash
S3_ENDPOINT=s3.amazonaws.com
S3_PORT=443
S3_USE_SSL=true
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_HOT=hot-bucket
S3_BUCKET_COLD=cold-bucket
```

### Separate Endpoints Mode

```bash
# HOT storage (AWS S3)
S3_HOT_ENDPOINT=s3.us-east-1.amazonaws.com
S3_HOT_PORT=443
S3_HOT_USE_SSL=true
S3_HOT_ACCESS_KEY=aws-access-key
S3_HOT_SECRET_KEY=aws-secret-key
S3_HOT_BUCKET=my-hot-bucket

# COLD storage (Backblaze B2)
S3_COLD_ENDPOINT=s3.us-west-004.backblazeb2.com
S3_COLD_PORT=443
S3_COLD_USE_SSL=true
S3_COLD_ACCESS_KEY=b2-access-key
S3_COLD_SECRET_KEY=b2-secret-key
S3_COLD_BUCKET=my-cold-bucket
```

Loading configuration from environment:

```typescript
import type { S3StrataConfig } from 's3strata';

const config: S3StrataConfig = {
  hot: {
    endpoint: process.env.S3_HOT_ENDPOINT!,
    port: parseInt(process.env.S3_HOT_PORT || '443'),
    useSSL: process.env.S3_HOT_USE_SSL !== 'false',
    accessKey: process.env.S3_HOT_ACCESS_KEY!,
    secretKey: process.env.S3_HOT_SECRET_KEY!,
    bucket: process.env.S3_HOT_BUCKET!,
  },
  cold: {
    endpoint: process.env.S3_COLD_ENDPOINT!,
    port: parseInt(process.env.S3_COLD_PORT || '443'),
    useSSL: process.env.S3_COLD_USE_SSL !== 'false',
    accessKey: process.env.S3_COLD_ACCESS_KEY!,
    secretKey: process.env.S3_COLD_SECRET_KEY!,
    bucket: process.env.S3_COLD_BUCKET!,
  },
};
```

## Workflow Example

```typescript
import { FileManager, StorageTier, FileVisibility } from 's3strata';

// Configure multi-endpoint setup
const config: S3StrataConfig = {
  hot: {
    endpoint: 's3.amazonaws.com',
    accessKey: process.env.AWS_KEY!,
    secretKey: process.env.AWS_SECRET!,
    bucket: 'premium-storage',
  },
  cold: {
    endpoint: 's3.us-west-004.backblazeb2.com',
    accessKey: process.env.B2_KEY!,
    secretKey: process.env.B2_SECRET!,
    bucket: 'cheap-archive',
  },
};

const fileManager = new FileManager(config, adapter);

// 1. User uploads a file -> goes to HOT (AWS S3)
const file = await fileManager.upload(userFileBuffer, {
  tier: StorageTier.HOT,
  visibility: FileVisibility.PRIVATE,
  hotDuration: 30 * 24 * 60 * 60, // 30 days
});

// 2. File is on AWS S3, get presigned URL
const url = await fileManager.getUrl(file);
// Returns: https://premium-storage.s3.amazonaws.com/private/...?signature=...

// 3. After 30 days, automatic archival moves to COLD (Backblaze B2)
const archivedCount = await fileManager.archiveExpiredHotFiles();
// File is now on Backblaze B2

// 4. Get URL for archived file (still works transparently)
const archivedUrl = await fileManager.getUrl(file);
// Returns: https://cheap-archive.s3.us-west-004.backblazeb2.com/private/...?signature=...
```

## Custom Path Prefixes Per Tier

You can also customize path prefixes for each tier:

```typescript
const config: S3StrataConfig = {
  hot: {
    endpoint: 's3.amazonaws.com',
    accessKey: 'key',
    secretKey: 'secret',
    bucket: 'hot-bucket',
    publicPrefix: 'pub',      // Custom public prefix
    privatePrefix: 'priv',    // Custom private prefix
  },
  cold: {
    endpoint: 's3.backblazeb2.com',
    accessKey: 'key',
    secretKey: 'secret',
    bucket: 'cold-bucket',
    publicPrefix: 'public',   // Standard prefix
    privatePrefix: 'private', // Standard prefix
  },
};
```

## Migration Strategy

### From Shared to Separate Endpoints

1. **Phase 1**: Continue using shared endpoint
2. **Phase 2**: Add separate endpoint config, set both to same values
3. **Phase 3**: Update COLD endpoint to new provider
4. **Phase 4**: Migrate existing COLD files to new provider
5. **Phase 5**: Remove shared config

```typescript
// Phase 2: Transition config
const config: S3StrataConfig = {
  // Keep shared config for compatibility
  endpoint: 's3.amazonaws.com',
  accessKey: 'key',
  secretKey: 'secret',
  hotBucket: 'hot',
  coldBucket: 'cold',

  // Add separate configs (currently same)
  hot: {
    endpoint: 's3.amazonaws.com',
    accessKey: 'key',
    secretKey: 'secret',
    bucket: 'hot',
  },
  cold: {
    endpoint: 's3.amazonaws.com',  // Will change in Phase 3
    accessKey: 'key',
    secretKey: 'secret',
    bucket: 'cold',
  },
};
```

## Provider-Specific Notes

### Backblaze B2
- Endpoint format: `s3.{region}.backblazeb2.com`
- Regions: us-west-001, us-west-002, us-west-004, eu-central-003
- Create application keys in B2 console

### Wasabi
- Endpoint: `s3.wasabisys.com` (or region-specific)
- No egress fees (great for COLD storage with frequent reads)

### DigitalOcean Spaces
- Endpoint format: `{region}.digitaloceanspaces.com`
- Regions: nyc3, sfo3, sgp1, fra1, etc.

### MinIO
- Self-hosted, use your own domain/IP
- Default port: 9000
- Great for HOT storage on-premises

### Cloudflare R2
- Endpoint format: `{account-id}.r2.cloudflarestorage.com`
- Zero egress fees
- Good for both HOT and COLD

## Troubleshooting

### Error: "Missing S3 configuration for HOT tier"

Make sure you provide either:
- Shared config: `endpoint`, `accessKey`, `secretKey`, `hotBucket`
- OR tier-specific: `hot: { endpoint, accessKey, secretKey, bucket }`

### Cross-provider file movement is slow

This is expected. Moving files between providers requires:
1. Download from source provider
2. Upload to destination provider

For large files, consider running archival during off-peak hours.

### Authentication errors on one tier

Check that credentials are correct for that specific endpoint. Each provider has different credential formats.
