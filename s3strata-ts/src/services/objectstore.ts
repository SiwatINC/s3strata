import { S3Client } from "bun";
import type { S3StrataConfig, S3TierConfig } from "../config";
import { getTierConfig } from "../config";
import { StorageTier } from "../types/storage-tier";

/**
 * Low-level S3 operations abstraction
 * Handles dual-bucket (HOT/COLD) architecture
 * Supports different S3 endpoints for each tier
 */
export class ObjectStoreService {
	private readonly hotClient: ReturnType<typeof this.createClient>;
	private readonly coldClient: ReturnType<typeof this.createClient>;
	private readonly hotConfig: S3TierConfig;
	private readonly coldConfig: S3TierConfig;

	constructor(config: S3StrataConfig) {
		this.hotConfig = getTierConfig(config, StorageTier.HOT);
		this.coldConfig = getTierConfig(config, StorageTier.COLD);
		this.hotClient = this.createClient(this.hotConfig);
		this.coldClient = this.createClient(this.coldConfig);
	}

	/**
	 * Create S3 client for a specific tier configuration
	 */
	private createClient(tierConfig: S3TierConfig) {
		const protocol = tierConfig.useSSL !== false ? "https" : "http";
		const port = tierConfig.port ?? (tierConfig.useSSL !== false ? 443 : 80);
		const endpoint = `${protocol}://${tierConfig.endpoint}:${port}`;

		return {
			bucket: tierConfig.bucket,
			endpoint: tierConfig.endpoint,
			port: tierConfig.port ?? 443,
			useSSL: tierConfig.useSSL !== false,
			credentials: {
				endpoint,
				accessKeyId: tierConfig.accessKey,
				secretAccessKey: tierConfig.secretKey,
				bucket: tierConfig.bucket,
			},
		};
	}

	/**
	 * Get client for a specific tier
	 */
	private getClient(tier: StorageTier) {
		return tier === StorageTier.HOT ? this.hotClient : this.coldClient;
	}

	/**
	 * Upload a file to S3
	 */
	async upload(tier: StorageTier, path: string, data: Buffer | Blob): Promise<void> {
		const client = this.getClient(tier);
		await S3Client.write(path, data, client.credentials);
	}

	/**
	 * Download a file from S3
	 */
	async download(tier: StorageTier, path: string): Promise<Buffer> {
		const client = this.getClient(tier);
		const file = S3Client.file(path, client.credentials);

		if (!file) {
			throw new Error(`File not found: ${path}`);
		}

		return Buffer.from(await file.arrayBuffer());
	}

	/**
	 * Delete a file from S3
	 */
	async delete(tier: StorageTier, path: string): Promise<void> {
		const client = this.getClient(tier);
		await S3Client.unlink(path, client.credentials);
	}

	/**
	 * Copy a file within or between tiers
	 */
	async copy(
		sourceTier: StorageTier,
		sourcePath: string,
		destTier: StorageTier,
		destPath: string,
	): Promise<void> {
		// Download from source
		const data = await this.download(sourceTier, sourcePath);

		// Upload to destination
		await this.upload(destTier, destPath, data);
	}

	/**
	 * Move a file within or between tiers
	 */
	async move(
		sourceTier: StorageTier,
		sourcePath: string,
		destTier: StorageTier,
		destPath: string,
	): Promise<void> {
		// Copy to destination
		await this.copy(sourceTier, sourcePath, destTier, destPath);

		// Delete from source
		await this.delete(sourceTier, sourcePath);
	}

	/**
	 * Check if a file exists
	 */
	async exists(tier: StorageTier, path: string): Promise<boolean> {
		try {
			const client = this.getClient(tier);
			const file = S3Client.file(path, client.credentials);
			return await file.exists();
		} catch {
			return false;
		}
	}

	/**
	 * Generate a presigned URL for private file access
	 */
	async getPresignedUrl(tier: StorageTier, path: string, expiresIn: number): Promise<string> {
		const client = this.getClient(tier);
		return S3Client.presign(path, {
			...client.credentials,
			expiresIn,
		});
	}

	/**
	 * Generate a public URL
	 */
	getPublicUrl(tier: StorageTier, path: string): string {
		const client = this.getClient(tier);
		const protocol = client.useSSL ? "https" : "http";
		const port = client.port;
		const portSuffix = port === 443 || port === 80 ? "" : `:${port}`;

		return `${protocol}://${client.endpoint}${portSuffix}/${client.bucket}/${path}`;
	}
}
