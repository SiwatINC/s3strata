import { FileVisibility } from "./types/file-visibility";
import { StorageTier } from "./types/storage-tier";

/**
 * S3 tier-specific configuration
 */
export interface S3TierConfig {
	/** S3 endpoint (e.g., "s3.amazonaws.com") */
	endpoint: string;
	/** S3 port (default: 443) */
	port?: number;
	/** Use SSL/TLS (default: true) */
	useSSL?: boolean;
	/** S3 access key */
	accessKey: string;
	/** S3 secret key */
	secretKey: string;
	/** Bucket name */
	bucket: string;
	/** Path prefix for public files (default: "public") */
	publicPrefix?: string;
	/** Path prefix for private files (default: "private") */
	privatePrefix?: string;
}

/**
 * Configuration for S3Strata
 * Supports two modes:
 * 1. Shared endpoint mode: Single endpoint/credentials for both tiers
 * 2. Separate endpoint mode: Different endpoints/credentials per tier
 */
export interface S3StrataConfig {
	// Shared endpoint mode (backward compatible)
	/** S3 endpoint (e.g., "s3.amazonaws.com") - used if hot/cold configs not provided */
	endpoint?: string;
	/** S3 port (default: 443) - used if hot/cold configs not provided */
	port?: number;
	/** Use SSL/TLS (default: true) - used if hot/cold configs not provided */
	useSSL?: boolean;
	/** S3 access key - used if hot/cold configs not provided */
	accessKey?: string;
	/** S3 secret key - used if hot/cold configs not provided */
	secretKey?: string;
	/** HOT storage bucket name - used if hot config not provided */
	hotBucket?: string;
	/** COLD storage bucket name - used if cold config not provided */
	coldBucket?: string;
	/** Path prefix for public files in HOT storage (default: "public") */
	publicHotPrefix?: string;
	/** Path prefix for private files in HOT storage (default: "private") */
	privateHotPrefix?: string;
	/** Path prefix for public files in COLD storage (default: "public") */
	publicColdPrefix?: string;
	/** Path prefix for private files in COLD storage (default: "private") */
	privateColdPrefix?: string;

	// Separate endpoint mode
	/** HOT storage configuration (overrides shared config) */
	hot?: S3TierConfig;
	/** COLD storage configuration (overrides shared config) */
	cold?: S3TierConfig;
}

/**
 * Get tier configuration, resolving shared vs separate endpoint config
 */
export function getTierConfig(config: S3StrataConfig, tier: StorageTier): S3TierConfig {
	// If tier-specific config is provided, use it
	if (tier === StorageTier.HOT && config.hot) {
		return config.hot;
	}
	if (tier === StorageTier.COLD && config.cold) {
		return config.cold;
	}

	// Fall back to shared config
	if (!config.endpoint || !config.accessKey || !config.secretKey) {
		throw new Error(
			`Missing S3 configuration for ${tier} tier. Provide either shared config (endpoint, accessKey, secretKey, ${tier === StorageTier.HOT ? "hotBucket" : "coldBucket"}) or tier-specific config (${tier.toLowerCase()}).`,
		);
	}

	const bucket = tier === StorageTier.HOT ? config.hotBucket : config.coldBucket;
	if (!bucket) {
		throw new Error(
			`Missing bucket configuration for ${tier} tier. Provide either ${tier === StorageTier.HOT ? "hotBucket" : "coldBucket"} or ${tier.toLowerCase()}.bucket`,
		);
	}

	return {
		endpoint: config.endpoint,
		port: config.port,
		useSSL: config.useSSL,
		accessKey: config.accessKey,
		secretKey: config.secretKey,
		bucket,
		publicPrefix: tier === StorageTier.HOT ? config.publicHotPrefix : config.publicColdPrefix,
		privatePrefix: tier === StorageTier.HOT ? config.privateHotPrefix : config.privateColdPrefix,
	};
}

/**
 * Get bucket name for a storage tier
 */
export function getBucketName(config: S3StrataConfig, tier: StorageTier): string {
	return getTierConfig(config, tier).bucket;
}

/**
 * Get path prefix for a tier and visibility combination
 */
export function getPathPrefix(
	config: S3StrataConfig,
	tier: StorageTier,
	visibility: FileVisibility,
): string {
	const tierConfig = getTierConfig(config, tier);
	if (visibility === FileVisibility.PUBLIC) {
		return tierConfig.publicPrefix ?? "public";
	}
	return tierConfig.privatePrefix ?? "private";
}
