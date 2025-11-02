// Export types
export type {
	PhysicalFile,
	StorageAdapter,
	StorageConfig,
	FileStorageConfig,
	UploadOptions,
	GetUrlOptions,
	SetVisibilityOptions,
	SetTierOptions,
	SetHotDurationOptions,
} from "./types";

export { StorageTier, FileVisibility } from "./types";

// Export configuration
export type { S3StrataConfig, S3TierConfig } from "./config";
export { getBucketName, getPathPrefix, getTierConfig } from "./config";

// Export constants
export {
	DEFAULT_PRESIGNED_URL_EXPIRATION,
	MAX_FILE_SIZE,
	DEFAULT_STORAGE_TIER,
	DEFAULT_VISIBILITY,
} from "./constants";

// Export services
export { ObjectStoreService } from "./services/objectstore";
export { FileManager } from "./services/file-manager";

// Export examples
export { PrismaStorageAdapter } from "./examples/prisma-adapter";
