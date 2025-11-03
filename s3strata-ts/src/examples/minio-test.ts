/**
 * E2E test for S3Strata against a local MinIO server
 */

import type { S3StrataConfig } from "../config";
import { FileManager, FileVisibility, StorageTier } from "../index";
import type { PhysicalFile, StorageAdapter } from "../types";

// In-memory storage adapter (for demonstration purposes)
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
        console.log("Created file record in memory:", file);
		return file;
	}

	async findById(id: string | number): Promise<PhysicalFile | null> {
        const file = this.files.get(Number(id)) ?? null;
        console.log("Found file record in memory:", file);
		return file;
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
        console.log("Updated file record in memory:", updated);
		return updated;
	}

	async delete(id: string | number): Promise<void> {
        console.log("Deleted file record in memory for id:", id);
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

async function testMinio() {
	// 1. Configure S3Strata for local MinIO
	const config: S3StrataConfig = {
		endpoint: "127.0.0.1",
		port: 9000,
		useSSL: false,
		accessKey: "minioadmin",
		secretKey: "minioadmin",
		hotBucket: "hot-bucket",
		coldBucket: "cold-bucket",
	};

	// 2. Create storage adapter
	const adapter = new InMemoryStorageAdapter();

	// 3. Initialize FileManager
	const fileManager = new FileManager(config, adapter);

    console.log("Running test against MinIO server at localhost:9000");

	// 4. Upload a file
	const fileBuffer = Buffer.from("Hello, MinIO!");
    const filename = `test-file-${Date.now()}.txt`;
	const file = await fileManager.upload(fileBuffer, {
		tier: StorageTier.HOT,
		visibility: FileVisibility.PRIVATE,
		filename: filename,
	});

	console.log("Uploaded file:", file);

	// 5. Get presigned URL
	const privateUrl = await fileManager.getUrl(file);
	console.log("Private URL:", privateUrl);

    // 6. Verify file exists
    const exists = await fileManager.exists(file);
    console.log("File exists in MinIO:", exists);
    if (!exists) {
        throw new Error("File should exist in MinIO after upload.");
    }

	// 7. Make file public
	const publicFile = await fileManager.setVisibility(file, {
		visibility: FileVisibility.PUBLIC,
	});
    console.log("Made file public:", publicFile);

	// 8. Get public URL
	const publicUrl = await fileManager.getUrl(publicFile);
	console.log("Public URL:", publicUrl);

	// 9. Delete file
	await fileManager.delete(publicFile);
	console.log("File deleted");

    // 10. Verify file does not exist anymore
    const existsAfterDelete = await fileManager.exists(publicFile);
    console.log("File exists in MinIO after delete:", existsAfterDelete);
    if (existsAfterDelete) {
        throw new Error("File should not exist in MinIO after delete.");
    }

    console.log("MinIO test completed successfully!");

    // 11. Test listFiles
    console.log("Testing listFiles...");
    const fileBuffer2 = Buffer.from("Hello, listFiles!");
    const filename2 = `test-file-${Date.now()}.txt`;
    const file2 = await fileManager.upload(fileBuffer2, {
        tier: StorageTier.HOT,
        visibility: FileVisibility.PRIVATE,
        filename: filename2,
    });
    console.log("Uploaded second file:", file2);

    const allFiles = await fileManager.listFiles();
    console.log("All files:", allFiles);
    if (allFiles.length !== 1) {
        throw new Error(`Expected 1 file, but got ${allFiles.length}`);
    }
    if (allFiles[0].id !== file2.id) {
        throw new Error(`Expected file id ${file2.id}, but got ${allFiles[0].id}`);
    }

    await fileManager.delete(file2);
    console.log("Deleted second file");

    const allFilesAfterDelete = await fileManager.listFiles();
    console.log("All files after delete:", allFilesAfterDelete);
    if (allFilesAfterDelete.length !== 0) {
        throw new Error(`Expected 0 files, but got ${allFilesAfterDelete.length}`);
    }

    console.log("listFiles test completed successfully!");
}

// Run test
if (import.meta.main) {
	await testMinio().catch(console.error);
}
