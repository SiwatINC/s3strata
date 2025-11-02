import type { StorageTier } from "./storage-tier";

/**
 * Physical file record representing a file stored in object storage
 * This is the core DTO that storage adapters must implement
 */
export interface PhysicalFile {
	/** Unique identifier for the file */
	id: string | number;
	/** Storage tier where the file is stored */
	storage_tier: StorageTier;
	/** Original filename */
	filename: string;
	/** Full path in object storage (including visibility prefix) */
	path: string;
	/** Optional expiration date for HOT storage files */
	hot_until: Date | null;
	/** Creation timestamp */
	created_at?: Date;
	/** Last update timestamp */
	updated_at?: Date;
}
