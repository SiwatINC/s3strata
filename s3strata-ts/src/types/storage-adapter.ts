import type { PhysicalFile } from "./physical-file";
import type { StorageTier } from "./storage-tier";

/**
 * Storage adapter interface for database operations
 * Implement this interface to integrate with your own database/ORM
 */
export interface StorageAdapter {
	create(data: {
		storage_tier: StorageTier;
		filename: string;
		path: string;
		hot_until: Date | null;
	}): Promise<PhysicalFile>;

	findById(id: string | number): Promise<PhysicalFile | null>;

	update(
		id: string | number,
		data: {
			storage_tier?: StorageTier;
			path?: string;
			hot_until?: Date | null;
		},
	): Promise<PhysicalFile>;

	delete(id: string | number): Promise<void>;

	findExpiredHotFiles(): Promise<PhysicalFile[]>;

	/**
	 * Find all file records
	 */
	findAll(): Promise<PhysicalFile[]>;
}
