import type { FileVisibility } from "./file-visibility";
import type { StorageTier } from "./storage-tier";

/**
 * Storage configuration for a specific tier
 */
export interface StorageConfig {
	endpoint: string;
	port: number;
	useSSL: boolean;
	accessKey: string;
	secretKey: string;
	bucket: string;
}

/**
 * Complete storage configuration for all tiers
 */
export interface FileStorageConfig {
	hot: StorageConfig;
	cold: StorageConfig;
}

/**
 * File upload options
 */
export interface UploadOptions {
	/** Storage tier (HOT or COLD), defaults to HOT */
	tier?: StorageTier;
	/** File visibility (PUBLIC or PRIVATE), defaults to PRIVATE */
	visibility?: FileVisibility;
	/** Custom filename (optional) */
	filename?: string;
	/** Custom path suffix (optional, auto-generated if not provided) */
	pathSuffix?: string;
	/** Duration in seconds to keep file in HOT storage (only for HOT tier) */
	/** If null or undefined, file stays in HOT permanently */
	hotDuration?: number;
}

/**
 * URL generation options
 */
export interface GetUrlOptions {
	/** Presign duration in seconds (default: 14400 = 4 hours) */
	/** Only used for PRIVATE files, ignored for PUBLIC files */
	expiresIn?: number;
}

/**
 * Options for changing file visibility
 */
export interface SetVisibilityOptions {
	/** New visibility level */
	visibility: FileVisibility;
	/** Whether to move the file immediately (default: true) */
	moveFile?: boolean;
}

/**
 * Options for changing storage tier
 */
export interface SetTierOptions {
	/** New storage tier */
	tier: StorageTier;
	/** Whether to move the file immediately (default: true) */
	moveFile?: boolean;
	/** Duration in seconds to keep file in HOT storage (only when tier=HOT) */
	/** If null, file stays in HOT permanently */
	hotDuration?: number;
}

/**
 * Options for setting hot storage duration
 */
export interface SetHotDurationOptions {
	/** Duration in seconds to keep file in HOT storage */
	/** If null, removes duration (file stays in HOT permanently) */
	/** If 0, marks for immediate archival to COLD */
	duration: number | null;
}
