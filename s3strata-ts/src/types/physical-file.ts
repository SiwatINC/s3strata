import type { StorageTier } from "./storage-tier";

/**
 * Physical file record representing a file stored in object storage
 * This is the core DTO that storage adapters must implement
 *
 * Note: storage_tier accepts string literals "HOT" | "COLD" for compatibility
 * with Prisma and other ORMs that generate their own enum types
 */
export interface PhysicalFile {
	/** Unique identifier for the file */
	id: string | number;
	/** Storage tier where the file is stored (accepts "HOT" | "COLD" or StorageTier enum) */
	storage_tier: StorageTier | "HOT" | "COLD";
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
