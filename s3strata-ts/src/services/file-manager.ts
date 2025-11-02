import type { PhysicalFile } from "../types/physical-file";
import type { StorageAdapter } from "../types/storage-adapter";
import { ObjectStoreService } from "./objectstore";
import {
	FileVisibility,
	type UploadOptions,
	type GetUrlOptions,
	type SetVisibilityOptions,
	type SetTierOptions,
	type SetHotDurationOptions,
} from "../types";
import {
	DEFAULT_STORAGE_TIER,
	DEFAULT_VISIBILITY,
	DEFAULT_PRESIGNED_URL_EXPIRATION,
} from "../constants";
import { getPathPrefix, type S3StrataConfig } from "../config";
import { StorageTier } from "../types/storage-tier";
import { randomUUID } from "node:crypto";

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
	private buildPath(
		tier: StorageTier,
		visibility: FileVisibility,
		pathSuffix: string,
	): string {
		const prefix = getPathPrefix(this.config, tier, visibility);
		return `${prefix}/${pathSuffix}`;
	}

	/**
	 * Upload a file to object storage
	 */
	async upload(
		data: Buffer | Blob,
		options: UploadOptions = {},
	): Promise<PhysicalFile> {
		const tier = options.tier ?? DEFAULT_STORAGE_TIER;
		const visibility = options.visibility ?? DEFAULT_VISIBILITY;

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
	async getUrl(
		file: PhysicalFile,
		options: GetUrlOptions = {},
	): Promise<string> {
		const visibility = this.getVisibilityFromPath(file.path);

		if (visibility === FileVisibility.PUBLIC) {
			// Return direct public URL
			return this.objectStore.getPublicUrl(file.storage_tier, file.path);
		}

		// Return presigned URL for private files
		const expiresIn = options.expiresIn ?? DEFAULT_PRESIGNED_URL_EXPIRATION;
		return await this.objectStore.getPresignedUrl(
			file.storage_tier,
			file.path,
			expiresIn,
		);
	}

	/**
	 * Change file visibility (PUBLIC <-> PRIVATE)
	 * Moves file between /public and /private prefixes
	 */
	async setVisibility(
		file: PhysicalFile,
		options: SetVisibilityOptions,
	): Promise<PhysicalFile> {
		const currentVisibility = this.getVisibilityFromPath(file.path);
		const newVisibility = options.visibility;

		// No change needed
		if (currentVisibility === newVisibility) {
			return file;
		}

		const moveFile = options.moveFile ?? true;

		// Extract path suffix (everything after visibility prefix)
		const currentPrefix = getPathPrefix(
			this.config,
			file.storage_tier,
			currentVisibility,
		);
		const pathSuffix = file.path.substring(currentPrefix.length + 1); // +1 for the slash

		// Build new path
		const newPath = this.buildPath(file.storage_tier, newVisibility, pathSuffix);

		// Move file in S3 if requested
		if (moveFile) {
			await this.objectStore.move(
				file.storage_tier,
				file.path,
				file.storage_tier,
				newPath,
			);
		}

		// Update database via adapter
		const updatedFile = await this.adapter.update(file.id, { path: newPath });

		return updatedFile;
	}

	/**
	 * Move file between storage tiers (HOT <-> COLD)
	 */
	async setTier(
		file: PhysicalFile,
		options: SetTierOptions,
	): Promise<PhysicalFile> {
		const newTier = options.tier;

		// No change needed
		if (file.storage_tier === newTier) {
			return file;
		}

		const moveFile = options.moveFile ?? true;

		// Calculate hot_until if moving to HOT and hotDuration is provided
		let hotUntil: Date | null | undefined = undefined;
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
				file.storage_tier,
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
		// Delete from S3
		await this.objectStore.delete(file.storage_tier, file.path);

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
		return await this.objectStore.exists(file.storage_tier, file.path);
	}

	/**
	 * Set hot storage duration for a file
	 * Only applicable to HOT tier files
	 */
	async setHotDuration(
		file: PhysicalFile,
		options: SetHotDurationOptions,
	): Promise<PhysicalFile> {
		// Only applies to HOT tier files
		if (file.storage_tier !== StorageTier.HOT) {
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
}
