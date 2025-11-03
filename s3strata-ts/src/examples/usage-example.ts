/**
 * Complete usage example for S3Strata
 *
 * This file demonstrates how to use S3Strata with a custom storage adapter.
 * For Prisma users, see prisma-adapter.ts
 */

import type { S3StrataConfig } from "../config";
import { FileManager, FileVisibility, StorageTier } from "../index";
import type { PhysicalFile, StorageAdapter } from "../types";

// Example: In-memory storage adapter (for demonstration purposes)
class InMemoryStorageAdapter implements StorageAdapter {
	private files = new Map<number, PhysicalFile>();
	private currentId = 1;

	async create(data: {
		storage_tier: StorageTier;
		filename: string;
		path: string;
		hot_until: Date | null;
	}): Promise<PhysicalFile> {
		const file: PhysicalFile = {
			id: this.currentId++,
			...data,
			created_at: new Date(),
			updated_at: new Date(),
		};
		this.files.set(file.id as number, file);
		return file;
	}

	async findById(id: string | number): Promise<PhysicalFile | null> {
		return this.files.get(Number(id)) ?? null;
	}

	async update(
		id: string | number,
		data: {
			storage_tier?: StorageTier;
			path?: string;
			hot_until?: Date | null;
		},
	): Promise<PhysicalFile> {
		const file = this.files.get(Number(id));
		if (!file) {
			throw new Error(`File not found: ${id}`);
		}
		const updated = { ...file, ...data, updated_at: new Date() };
		this.files.set(Number(id), updated);
		return updated;
	}

	async delete(id: string | number): Promise<void> {
		this.files.delete(Number(id));
	}

	async findExpiredHotFiles(): Promise<PhysicalFile[]> {
		const now = new Date();
		return Array.from(this.files.values()).filter(
			(file) =>
				file.storage_tier === StorageTier.HOT && file.hot_until !== null && file.hot_until <= now,
		);
	}

	async findAll(): Promise<PhysicalFile[]> {
		return Array.from(this.files.values());
	}
}

// Example usage - Shared endpoint mode
async function exampleSharedEndpoint() {
	// 1. Configure S3Strata (shared endpoint for both tiers)
	const config: S3StrataConfig = {
		endpoint: "s3.amazonaws.com",
		port: 443,
		useSSL: true,
		accessKey: process.env.S3_ACCESS_KEY || "your-access-key",
		secretKey: process.env.S3_SECRET_KEY || "your-secret-key",
		hotBucket: "my-hot-bucket",
		coldBucket: "my-cold-bucket",
		// Advanced options (optional) - customize defaults
		advanced: {
			defaultPresignedUrlExpiration: 7200, // 2 hours (default: 14400 = 4 hours)
			maxFileSize: 500 * 1024 * 1024, // 500MB (default: Infinity = no limit)
			defaultStorageTier: StorageTier.HOT, // default: StorageTier.HOT
			defaultVisibility: FileVisibility.PRIVATE, // default: FileVisibility.PRIVATE
		},
	};

	// 2. Create storage adapter
	const adapter = new InMemoryStorageAdapter();

	// 3. Initialize FileManager
	const fileManager = new FileManager(config, adapter);

	// 4. Upload a file
	const fileBuffer = Buffer.from("Hello, World!");
	const file = await fileManager.upload(fileBuffer, {
		tier: StorageTier.HOT,
		visibility: FileVisibility.PRIVATE,
		filename: "hello.txt",
		hotDuration: 7 * 24 * 60 * 60, // 7 days
	});

	console.log("Uploaded file:", file);

	// 5. Get presigned URL
	const privateUrl = await fileManager.getUrl(file);
	console.log("Private URL:", privateUrl);

	// 6. Make file public
	const publicFile = await fileManager.setVisibility(file, {
		visibility: FileVisibility.PUBLIC,
	});

	// 7. Get public URL
	const publicUrl = await fileManager.getUrl(publicFile);
	console.log("Public URL:", publicUrl);

	// 8. Move to cold storage
	const coldFile = await fileManager.setTier(publicFile, {
		tier: StorageTier.COLD,
	});

	console.log("Moved to COLD:", coldFile);

	// 9. Check if file exists
	const exists = await fileManager.exists(coldFile);
	console.log("File exists:", exists);

	// 10. Archive expired files
	const archivedCount = await fileManager.archiveExpiredHotFiles();
	console.log("Archived files:", archivedCount);

	// 11. Delete file
	await fileManager.delete(coldFile);
	console.log("File deleted");
}

// Example usage - Separate endpoints mode
async function exampleSeparateEndpoints() {
	// Configure S3Strata with different endpoints for each tier
	const config: S3StrataConfig = {
		// HOT storage on AWS S3
		hot: {
			endpoint: "s3.us-east-1.amazonaws.com",
			port: 443,
			useSSL: true,
			accessKey: process.env.S3_HOT_ACCESS_KEY || "hot-access-key",
			secretKey: process.env.S3_HOT_SECRET_KEY || "hot-secret-key",
			bucket: "my-fast-ssd-bucket",
		},
		// COLD storage on a different provider (e.g., Backblaze B2, Wasabi, etc.)
		cold: {
			endpoint: "s3.us-west-004.backblazeb2.com",
			port: 443,
			useSSL: true,
			accessKey: process.env.S3_COLD_ACCESS_KEY || "cold-access-key",
			secretKey: process.env.S3_COLD_SECRET_KEY || "cold-secret-key",
			bucket: "my-archive-bucket",
		},
		// Advanced options apply to both tiers
		advanced: {
			defaultPresignedUrlExpiration: 3600, // 1 hour
			maxFileSize: 1024 * 1024 * 1024, // 1GB
			defaultStorageTier: StorageTier.HOT,
			defaultVisibility: FileVisibility.PRIVATE,
		},
	};

	const adapter = new InMemoryStorageAdapter();
	const fileManager = new FileManager(config, adapter);

	// Upload to HOT (AWS S3)
	const fileBuffer = Buffer.from("Important data");
	const file = await fileManager.upload(fileBuffer, {
		tier: StorageTier.HOT,
		visibility: FileVisibility.PRIVATE,
		filename: "important.txt",
		hotDuration: 30 * 24 * 60 * 60, // 30 days
	});

	console.log("Uploaded to HOT (AWS S3):", file);

	// After 30 days, file will be automatically moved to COLD (Backblaze B2)
	// Or manually move to COLD storage
	const archivedFile = await fileManager.setTier(file, {
		tier: StorageTier.COLD,
	});

	console.log("Moved to COLD (Backblaze B2):", archivedFile);
}

// Run examples
if (import.meta.main) {
	console.log("=== Shared Endpoint Example ===");
	await exampleSharedEndpoint().catch(console.error);

	console.log("\n=== Separate Endpoints Example ===");
	await exampleSeparateEndpoints().catch(console.error);
}
