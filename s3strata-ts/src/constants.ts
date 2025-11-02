import { StorageTier } from "./types/storage-tier";
import { FileVisibility } from "./types/file-visibility";

/**
 * Default expiration time for presigned URLs (4 hours)
 */
export const DEFAULT_PRESIGNED_URL_EXPIRATION = 14400;

/**
 * Maximum file size (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Default storage tier for new files
 */
export const DEFAULT_STORAGE_TIER = StorageTier.HOT;

/**
 * Default file visibility for new files
 */
export const DEFAULT_VISIBILITY = FileVisibility.PRIVATE;
