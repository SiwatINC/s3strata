import type { PhysicalFile } from "./physical-file";
import type { StorageTier } from "./storage-tier";

/**
 * Storage adapter interface for database operations
 * Implement this interface to integrate with your own database/ORM
 */
export interface StorageAdapter {
	/**
	 * Create a new physical file record
	 */
	create(data: {
		storage_tier: StorageTier;
		filename: string;
		path: string;
		hot_until: Date | null;
	}): Promise<PhysicalFile>;

	/**
	 * Find a physical file by ID
	 */
	findById(id: string | number): Promise<PhysicalFile | null>;

	/**
	 * Update a physical file record
	 */
	update(
		id: string | number,
		data: {
			storage_tier?: StorageTier;
			path?: string;
			hot_until?: Date | null;
		},
	): Promise<PhysicalFile>;

	/**
	 * Delete a physical file record
	 */
	delete(id: string | number): Promise<void>;

	/**
	 * Find all HOT files that have expired (hot_until <= now)
	 * Used for automatic archival to COLD storage
	 */
	findExpiredHotFiles(): Promise<PhysicalFile[]>;
}
