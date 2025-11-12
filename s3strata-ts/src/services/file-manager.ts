import { randomUUID } from "node:crypto";
import {
	getBucketName,
	getDefaultPresignedUrlExpiration,
	getDefaultStorageTier,
	getDefaultVisibility,
	getPathPrefix,
	type S3StrataConfig,
} from "../config";
import {
	type AdoptOrphanOptions,
	type AdoptOrphanResult,
	type AllBucketObjects,
	type BucketObjects,
	type DeleteOrphanOptions,
	type DeleteOrphanResult,
	FileVisibility,
	type GetUrlOptions,
	type OrphanObject,
	type SetHotDurationOptions,
	type SetTierOptions,
	type SetVisibilityOptions,
	type UploadOptions,
} from "../types";
import type { PhysicalFile } from "../types/physical-file";
import type { StorageAdapter } from "../types/storage-adapter";
import { normalizeStorageTier, StorageTier } from "../types/storage-tier";
import { ObjectStoreService } from "./objectstore";

/**
 * High-level file management service
 * Works with PhysicalFile model via StorageAdapter
 */
export class FileManager {
	private readonly objectStore: ObjectStoreService;

	constructor(
		private readonly config: S3StrataConfig,
		private readonly adapter: StorageAdapter,
	) {
		this.objectStore = new ObjectStoreService(config);
	}

	/**
	 * Parse visibility from path
	 */
	private getVisibilityFromPath(path: string): FileVisibility {
		if (path.startsWith("public/")) {
			return FileVisibility.PUBLIC;
		}
		if (path.startsWith("private/")) {
			return FileVisibility.PRIVATE;
		}
		throw new Error(`Invalid path format: ${path}`);
	}

	/**
	 * Build full S3 path from tier, visibility, and custom path
	 */
	private buildPath(tier: StorageTier, visibility: FileVisibility, pathSuffix: string): string {
		const prefix = getPathPrefix(this.config, tier, visibility);
		return `${prefix}/${pathSuffix}`;
	}

	/**
	 * Upload a file to object storage
	 */
	async upload(data: Buffer | Blob, options: UploadOptions = {}): Promise<PhysicalFile> {
		const tier = options.tier ?? getDefaultStorageTier(this.config);
		const visibility = options.visibility ?? getDefaultVisibility(this.config);

		// Generate filename and path
		const filename = options.filename ?? `${randomUUID()}`;
		const pathSuffix = options.pathSuffix ?? `${randomUUID()}-${filename}`;
		const fullPath = this.buildPath(tier, visibility, pathSuffix);

		// Calculate hot_until if hotDuration is provided and tier is HOT
		let hotUntil: Date | null = null;
		if (tier === StorageTier.HOT && options.hotDuration !== undefined) {
			hotUntil = new Date(Date.now() + options.hotDuration * 1000);
		}

		// Upload to S3
		await this.objectStore.upload(tier, fullPath, data);

		// Create database record via adapter
		const physicalFile = await this.adapter.create({
			storage_tier: tier,
			filename,
			path: fullPath,
			hot_until: hotUntil,
		});

		return physicalFile;
	}

	/**
	 * Generate URL for a file
	 * - PUBLIC files: returns direct URL
	 * - PRIVATE files: returns presigned URL
	 */
	async getUrl(file: PhysicalFile, options: GetUrlOptions = {}): Promise<string> {
		const tier = normalizeStorageTier(file.storage_tier);
		const visibility = this.getVisibilityFromPath(file.path);

		if (visibility === FileVisibility.PUBLIC) {
			// Return direct public URL
			return this.objectStore.getPublicUrl(tier, file.path);
		}

		// Return presigned URL for private files
		const expiresIn = options.expiresIn ?? getDefaultPresignedUrlExpiration(this.config);
		return await this.objectStore.getPresignedUrl(tier, file.path, expiresIn);
	}

	/**
	 * Change file visibility (PUBLIC <-> PRIVATE)
	 * Moves file between /public and /private prefixes
	 */
	async setVisibility(file: PhysicalFile, options: SetVisibilityOptions): Promise<PhysicalFile> {
		const tier = normalizeStorageTier(file.storage_tier);
		const currentVisibility = this.getVisibilityFromPath(file.path);
		const newVisibility = options.visibility;

		// No change needed
		if (currentVisibility === newVisibility) {
			return file;
		}

		const moveFile = options.moveFile ?? true;

		// Extract path suffix (everything after visibility prefix)
		const currentPrefix = getPathPrefix(this.config, tier, currentVisibility);
		const pathSuffix = file.path.substring(currentPrefix.length + 1); // +1 for the slash

		// Build new path
		const newPath = this.buildPath(tier, newVisibility, pathSuffix);

		// Move file in S3 if requested
		if (moveFile) {
			await this.objectStore.move(tier, file.path, tier, newPath);
		}

		// Update database via adapter
		const updatedFile = await this.adapter.update(file.id, { path: newPath });

		return updatedFile;
	}

	/**
	 * Move file between storage tiers (HOT <-> COLD)
	 */
	async setTier(file: PhysicalFile, options: SetTierOptions): Promise<PhysicalFile> {
		const currentTier = normalizeStorageTier(file.storage_tier);
		const newTier = options.tier;

		// No change needed
		if (currentTier === newTier) {
			return file;
		}

		const moveFile = options.moveFile ?? true;

		// Calculate hot_until if moving to HOT and hotDuration is provided
		let hotUntil: Date | null | undefined;
		if (newTier === StorageTier.HOT) {
			if (options.hotDuration !== undefined) {
				hotUntil = new Date(Date.now() + options.hotDuration * 1000);
			}
		} else {
			// Moving to COLD, clear hot_until
			hotUntil = null;
		}

		// Move file in S3 if requested
		if (moveFile) {
			await this.objectStore.move(
				currentTier,
				file.path,
				newTier,
				file.path, // Keep same path (visibility stays the same)
			);
		}

		// Update database via adapter
		const updateData: { storage_tier: StorageTier; hot_until?: Date | null } = {
			storage_tier: newTier,
		};
		if (hotUntil !== undefined) {
			updateData.hot_until = hotUntil;
		}

		const updatedFile = await this.adapter.update(file.id, updateData);

		return updatedFile;
	}

	/**
	 * Delete a file from storage and database
	 */
	async delete(file: PhysicalFile): Promise<void> {
		const tier = normalizeStorageTier(file.storage_tier);
		// Delete from S3
		await this.objectStore.delete(tier, file.path);

		// Delete from database via adapter
		await this.adapter.delete(file.id);
	}

	/**
	 * Get file from database by ID
	 */
	async getById(id: string | number): Promise<PhysicalFile | null> {
		return await this.adapter.findById(id);
	}

	/**
	 * Check if file exists in storage
	 */
	async exists(file: PhysicalFile): Promise<boolean> {
		const tier = normalizeStorageTier(file.storage_tier);
		return await this.objectStore.exists(tier, file.path);
	}

	/**
	 * Set hot storage duration for a file
	 * Only applicable to HOT tier files
	 */
	async setHotDuration(file: PhysicalFile, options: SetHotDurationOptions): Promise<PhysicalFile> {
		const tier = normalizeStorageTier(file.storage_tier);
		// Only applies to HOT tier files
		if (tier !== StorageTier.HOT) {
			throw new Error("setHotDuration only applies to HOT tier files");
		}

		let hotUntil: Date | null = null;
		if (options.duration !== null) {
			if (options.duration === 0) {
				// Mark for immediate archival
				hotUntil = new Date();
			} else {
				hotUntil = new Date(Date.now() + options.duration * 1000);
			}
		}

		// Update database via adapter
		const updatedFile = await this.adapter.update(file.id, {
			hot_until: hotUntil,
		});

		return updatedFile;
	}

	/**
	 * Housekeeping: Move expired HOT files to COLD storage
	 * Returns the number of files moved
	 */
	async archiveExpiredHotFiles(): Promise<number> {
		// Find all HOT files where hot_until has passed via adapter
		const expiredFiles = await this.adapter.findExpiredHotFiles();

		let movedCount = 0;
		for (const file of expiredFiles) {
			try {
				await this.setTier(file, {
					tier: StorageTier.COLD,
					moveFile: true,
				});
				movedCount++;
			} catch (error) {
				console.error(`Failed to archive file ${file.id}:`, error);
				// Continue with other files
			}
		}

		return movedCount;
	}

	/**
	 * List all files from the database
	 */
	async listFiles(): Promise<PhysicalFile[]> {
		return await this.adapter.findAll();
	}

	/**
	 * INTERNAL/DEV: List all objects in all S3 buckets
	 * Returns a comprehensive JSON structure with all objects across both tiers
	 * Useful for debugging and inspecting the actual S3 state
	 */
	async listAllObjects(prefix?: string): Promise<AllBucketObjects> {
		const [hotObjects, coldObjects] = await Promise.all([
			this.objectStore.listObjects(StorageTier.HOT, prefix),
			this.objectStore.listObjects(StorageTier.COLD, prefix),
		]);

		const hotBucket: BucketObjects = {
			tier: StorageTier.HOT,
			bucket: getBucketName(this.config, StorageTier.HOT),
			objects: hotObjects,
			count: hotObjects.length,
		};

		const coldBucket: BucketObjects = {
			tier: StorageTier.COLD,
			bucket: getBucketName(this.config, StorageTier.COLD),
			objects: coldObjects,
			count: coldObjects.length,
		};

		return {
			hot: hotBucket,
			cold: coldBucket,
			totalCount: hotObjects.length + coldObjects.length,
			collectedAt: new Date(),
		};
	}

	/**
	 * List all orphan objects (objects in S3 that don't have a PhysicalFile record)
	 * Returns objects that exist in S3 but are not tracked in the database
	 */
	async listOrphanObjects(prefix?: string): Promise<OrphanObject[]> {
		// Get all objects from S3
		const [hotObjects, coldObjects, dbFiles] = await Promise.all([
			this.objectStore.listObjects(StorageTier.HOT, prefix),
			this.objectStore.listObjects(StorageTier.COLD, prefix),
			this.adapter.findAll(),
		]);

		// Build a Set of all paths that exist in the database
		const dbPaths = new Set(dbFiles.map((file) => file.path));

		// Find orphans in HOT tier
		const hotOrphans: OrphanObject[] = hotObjects
			.filter((obj) => !dbPaths.has(obj.key))
			.map((obj) => ({
				...obj,
				tier: StorageTier.HOT,
				bucket: getBucketName(this.config, StorageTier.HOT),
			}));

		// Find orphans in COLD tier
		const coldOrphans: OrphanObject[] = coldObjects
			.filter((obj) => !dbPaths.has(obj.key))
			.map((obj) => ({
				...obj,
				tier: StorageTier.COLD,
				bucket: getBucketName(this.config, StorageTier.COLD),
			}));

		return [...hotOrphans, ...coldOrphans];
	}

	/**
	 * Delete orphan objects from S3
	 * Removes objects that exist in S3 but don't have a PhysicalFile record
	 */
	async deleteOrphanObjects(options: DeleteOrphanOptions = {}): Promise<DeleteOrphanResult> {
		const orphans = await this.listOrphanObjects(options.prefix);

		// Filter by tier if specified
		const filteredOrphans = options.tier
			? orphans.filter((orphan) => orphan.tier === options.tier)
			: orphans;

		const result: DeleteOrphanResult = {
			deleted: 0,
			failed: 0,
			deletedPaths: [],
			errors: [],
			dryRun: options.dryRun ?? false,
		};

		for (const orphan of filteredOrphans) {
			try {
				if (!options.dryRun) {
					await this.objectStore.delete(orphan.tier, orphan.key);
				}
				result.deleted++;
				result.deletedPaths.push(orphan.key);
			} catch (error) {
				result.failed++;
				result.errors.push({
					path: orphan.key,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return result;
	}

	/**
	 * Adopt orphan objects by creating PhysicalFile records for them
	 * Creates database entries for objects that exist in S3 but aren't tracked
	 */
	async adoptOrphanObjects(options: AdoptOrphanOptions = {}): Promise<AdoptOrphanResult> {
		const orphans = await this.listOrphanObjects(options.prefix);

		// Filter by tier if specified
		const filteredOrphans = options.tier
			? orphans.filter((orphan) => orphan.tier === options.tier)
			: orphans;

		const result: AdoptOrphanResult = {
			adopted: 0,
			failed: 0,
			adoptedFileIds: [],
			errors: [],
		};

		// Default filename extractor: use the last segment of the path
		const extractFilename =
			options.extractFilename ??
			((path: string) => {
				const segments = path.split("/");
				return segments[segments.length - 1];
			});

		for (const orphan of filteredOrphans) {
			try {
				const filename = extractFilename(orphan.key);

				// Calculate hot_until if specified
				let hotUntil: Date | null = null;
				if (
					orphan.tier === StorageTier.HOT &&
					options.setHotUntil &&
					options.hotDuration !== undefined
				) {
					hotUntil = new Date(Date.now() + options.hotDuration * 1000);
				}

				const physicalFile = await this.adapter.create({
					storage_tier: orphan.tier,
					filename,
					path: orphan.key,
					hot_until: hotUntil,
				});

				result.adopted++;
				result.adoptedFileIds.push(physicalFile.id);
			} catch (error) {
				result.failed++;
				result.errors.push({
					path: orphan.key,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return result;
	}
}
