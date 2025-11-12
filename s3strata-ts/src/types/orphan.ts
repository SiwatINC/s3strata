import type { StorageTier } from "./storage-tier";

/**
 * Represents a single S3 object
 */
export interface S3Object {
	/** Object key/path in S3 */
	key: string;
	/** Last modified timestamp */
	lastModified?: Date;
	/** Object size in bytes */
	size?: number;
	/** ETag of the object */
	etag?: string;
	/** Storage class */
	storageClass?: string;
}

/**
 * Represents all objects in a single bucket
 */
export interface BucketObjects {
	/** Storage tier this bucket belongs to */
	tier: StorageTier;
	/** Bucket name */
	bucket: string;
	/** List of objects in this bucket */
	objects: S3Object[];
	/** Total count of objects */
	count: number;
}

/**
 * Represents all objects across all S3 buckets
 */
export interface AllBucketObjects {
	/** HOT tier bucket objects */
	hot: BucketObjects;
	/** COLD tier bucket objects */
	cold: BucketObjects;
	/** Total count across all buckets */
	totalCount: number;
	/** Timestamp when this data was collected */
	collectedAt: Date;
}

/**
 * Represents an orphan object (exists in S3 but not in database)
 */
export interface OrphanObject extends S3Object {
	/** Storage tier where this orphan exists */
	tier: StorageTier;
	/** Bucket name */
	bucket: string;
}

/**
 * Options for adopting orphan objects
 */
export interface AdoptOrphanOptions {
	/** Only adopt orphans matching this prefix */
	prefix?: string;
	/** Only adopt orphans from this tier */
	tier?: StorageTier;
	/** Custom function to extract filename from path */
	extractFilename?: (path: string) => string;
	/** Whether to set hot_until for adopted HOT tier files */
	setHotUntil?: boolean;
	/** Hot duration in seconds (only if setHotUntil is true) */
	hotDuration?: number;
}

/**
 * Result of adopting orphan objects
 */
export interface AdoptOrphanResult {
	/** Number of orphans successfully adopted */
	adopted: number;
	/** Number of orphans that failed to adopt */
	failed: number;
	/** List of adopted file IDs */
	adoptedFileIds: (string | number)[];
	/** List of errors that occurred */
	errors: Array<{ path: string; error: string }>;
}

/**
 * Options for deleting orphan objects
 */
export interface DeleteOrphanOptions {
	/** Only delete orphans matching this prefix */
	prefix?: string;
	/** Only delete orphans from this tier */
	tier?: StorageTier;
	/** Dry run mode - don't actually delete, just report what would be deleted */
	dryRun?: boolean;
}

/**
 * Result of deleting orphan objects
 */
export interface DeleteOrphanResult {
	/** Number of orphans successfully deleted */
	deleted: number;
	/** Number of orphans that failed to delete */
	failed: number;
	/** List of deleted paths */
	deletedPaths: string[];
	/** List of errors that occurred */
	errors: Array<{ path: string; error: string }>;
	/** Whether this was a dry run */
	dryRun: boolean;
}
