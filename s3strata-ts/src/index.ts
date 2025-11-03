// Export types

// Export configuration
export type { S3StrataConfig, S3TierConfig } from "./config";
export { getBucketName, getPathPrefix, getTierConfig } from "./config";
// Export constants
export {
	DEFAULT_PRESIGNED_URL_EXPIRATION,
	DEFAULT_STORAGE_TIER,
	DEFAULT_VISIBILITY,
	MAX_FILE_SIZE,
} from "./constants";
// Export examples
export { PrismaStorageAdapter } from "./examples/prisma-adapter";
export { FileManager } from "./services/file-manager";

// Export services
export { ObjectStoreService } from "./services/objectstore";
export type {
	FileStorageConfig,
	GetUrlOptions,
	PhysicalFile,
	SetHotDurationOptions,
	SetTierOptions,
	SetVisibilityOptions,
	StorageAdapter,
	StorageConfig,
	UploadOptions,
} from "./types";
export { FileVisibility, StorageTier } from "./types";
