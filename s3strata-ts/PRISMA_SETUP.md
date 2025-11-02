# Prisma Setup Guide

This guide shows how to integrate S3Strata with Prisma.

## 1. Install Dependencies

```bash
npm install s3strata @prisma/client
npm install -D prisma
```

## 2. Initialize Prisma

```bash
npx prisma init
```

## 3. Add Schema

Add this to your `schema.prisma`:

```prisma
// ... your other models

model PhysicalFile {
  id           Int          @id @default(autoincrement())
  storage_tier StorageTier
  filename     String
  path         String
  hot_until    DateTime?
  created_at   DateTime     @default(now())
  updated_at   DateTime     @updatedAt

  @@index([storage_tier, hot_until])
}

enum StorageTier {
  HOT
  COLD
}
```

## 4. Generate Prisma Client

```bash
npx prisma generate
npx prisma migrate dev --name add_physical_file
```

## 5. Create Your App

```typescript
// app.ts
import { FileManager, StorageTier, FileVisibility, PrismaStorageAdapter } from 's3strata';
import { PrismaClient } from '@prisma/client';
import type { S3StrataConfig } from 's3strata';

// Initialize Prisma
const prisma = new PrismaClient();

// Configure S3Strata
const config: S3StrataConfig = {
  endpoint: process.env.S3_ENDPOINT || 's3.amazonaws.com',
  port: parseInt(process.env.S3_PORT || '443'),
  useSSL: process.env.S3_USE_SSL !== 'false',
  accessKey: process.env.S3_ACCESS_KEY!,
  secretKey: process.env.S3_SECRET_KEY!,
  hotBucket: process.env.S3_BUCKET_HOT!,
  coldBucket: process.env.S3_BUCKET_COLD!,
};

// Create adapter and file manager
const adapter = new PrismaStorageAdapter(prisma);
const fileManager = new FileManager(config, adapter);

// Example usage
async function uploadUserFile(fileBuffer: Buffer, userId: number) {
  // Upload to hot storage with 30-day expiration
  const file = await fileManager.upload(fileBuffer, {
    tier: StorageTier.HOT,
    visibility: FileVisibility.PRIVATE,
    filename: `user-${userId}-document.pdf`,
    hotDuration: 30 * 24 * 60 * 60, // 30 days
  });

  // Generate presigned URL (4 hours)
  const url = await fileManager.getUrl(file);

  return { file, url };
}

// Run housekeeping job (e.g., via cron)
async function runHousekeeping() {
  console.log('Running housekeeping...');
  const count = await fileManager.archiveExpiredHotFiles();
  console.log(`Archived ${count} files from HOT to COLD`);
}

// Export for use in your application
export { fileManager, uploadUserFile, runHousekeeping };
```

## 6. Environment Variables

Create a `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# S3 Configuration
S3_ENDPOINT="s3.amazonaws.com"
S3_PORT="443"
S3_USE_SSL="true"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET_HOT="my-hot-bucket"
S3_BUCKET_COLD="my-cold-bucket"
```

## 7. Housekeeping Cron Job

Set up a cron job to archive expired files:

```typescript
// cron.ts
import { fileManager } from './app';

async function runCronJobs() {
  // Run every hour
  setInterval(async () => {
    try {
      const count = await fileManager.archiveExpiredHotFiles();
      console.log(`[${new Date().toISOString()}] Archived ${count} files`);
    } catch (error) {
      console.error('Housekeeping error:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
}

runCronJobs();
```

## 8. Usage in API Routes

### Express Example

```typescript
import express from 'express';
import { fileManager } from './app';
import { StorageTier, FileVisibility } from 's3strata';

const app = express();

// Upload endpoint
app.post('/upload', async (req, res) => {
  try {
    const fileBuffer = req.body; // or use multer for multipart

    const file = await fileManager.upload(fileBuffer, {
      tier: StorageTier.HOT,
      visibility: FileVisibility.PRIVATE,
      filename: 'uploaded-file.pdf',
      hotDuration: 7 * 24 * 60 * 60, // 7 days
    });

    const url = await fileManager.getUrl(file);

    res.json({ file, url });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get file URL endpoint
app.get('/files/:id/url', async (req, res) => {
  try {
    const file = await fileManager.getById(parseInt(req.params.id));
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const url = await fileManager.getUrl(file, {
      expiresIn: 3600, // 1 hour
    });

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate URL' });
  }
});

app.listen(3000);
```

## 9. Advanced Usage

### Custom File Relationships

You can extend the PhysicalFile model to add relationships:

```prisma
model PhysicalFile {
  id           Int          @id @default(autoincrement())
  storage_tier StorageTier
  filename     String
  path         String
  hot_until    DateTime?
  created_at   DateTime     @default(now())
  updated_at   DateTime     @updatedAt

  // Add relationships
  user_id      Int?
  user         User?        @relation(fields: [user_id], references: [id])

  submissions  Submission[]

  @@index([storage_tier, hot_until])
  @@index([user_id])
}

model User {
  id    Int            @id @default(autoincrement())
  name  String
  files PhysicalFile[]
}

model Submission {
  id              Int          @id @default(autoincrement())
  physical_file_id Int
  physical_file   PhysicalFile @relation(fields: [physical_file_id], references: [id])
}
```

### Soft Deletes

```prisma
model PhysicalFile {
  id           Int          @id @default(autoincrement())
  storage_tier StorageTier
  filename     String
  path         String
  hot_until    DateTime?
  created_at   DateTime     @default(now())
  updated_at   DateTime     @updatedAt
  deleted_at   DateTime?    // Add soft delete

  @@index([storage_tier, hot_until])
  @@index([deleted_at])
}
```

Then customize the adapter:

```typescript
class PrismaSoftDeleteAdapter extends PrismaStorageAdapter {
  async findById(id: string | number): Promise<PhysicalFile | null> {
    return await this.prisma.physicalFile.findFirst({
      where: { id, deleted_at: null },
    });
  }

  async delete(id: string | number): Promise<void> {
    // Soft delete instead of hard delete
    await this.prisma.physicalFile.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
```

## 10. Testing

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { PrismaClient } from '@prisma/client';
import { FileManager, StorageTier, FileVisibility, PrismaStorageAdapter } from 's3strata';

describe('S3Strata with Prisma', () => {
  let prisma: PrismaClient;
  let fileManager: FileManager;

  beforeAll(() => {
    prisma = new PrismaClient();
    const adapter = new PrismaStorageAdapter(prisma);
    const config = {
      endpoint: 's3.localhost',
      accessKey: 'test',
      secretKey: 'test',
      hotBucket: 'test-hot',
      coldBucket: 'test-cold',
    };
    fileManager = new FileManager(config, adapter);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('upload file', async () => {
    const buffer = Buffer.from('test');
    const file = await fileManager.upload(buffer, {
      tier: StorageTier.HOT,
      visibility: FileVisibility.PRIVATE,
      filename: 'test.txt',
    });

    expect(file.filename).toBe('test.txt');
    expect(file.storage_tier).toBe(StorageTier.HOT);
  });
});
```

## Troubleshooting

### Issue: `PrismaClient is not a constructor`

Make sure you've run `npx prisma generate` after defining your schema.

### Issue: Type errors with StorageTier

Ensure your Prisma schema's `StorageTier` enum matches S3Strata's enum exactly (HOT and COLD).

### Issue: Files not being archived

Check that:
1. The `hot_until` field is properly indexed
2. Your cron job is running
3. The `storage_tier` is set to HOT for files you want to archive
