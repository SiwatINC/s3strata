import type { PhysicalFile } from "../types/physical-file";
import type { StorageAdapter } from "../types/storage-adapter";
import type { StorageTier } from "../types/storage-tier";

/**
 * Example Prisma storage adapter implementation
 *
 * To use this adapter:
 * 1. Install Prisma: npm install @prisma/client
 * 2. Add the PhysicalFile model to your schema.prisma:
 *
 * ```prisma
 * model PhysicalFile {
 *   id           Int          @id @default(autoincrement())
 *   storage_tier StorageTier
 *   filename     String
 *   path         String
 *   hot_until    DateTime?
 *   created_at   DateTime     @default(now())
 *   updated_at   DateTime     @updatedAt
 * }
 *
 * enum StorageTier {
 *   HOT
 *   COLD
 * }
 * ```
 *
 * 3. Generate Prisma client: npx prisma generate
 * 4. Create an instance: new PrismaStorageAdapter(prismaClient)
 *
 * Note: This is an example implementation. You'll need to adjust it
 * to match your actual Prisma schema and client setup.
 */
export class PrismaStorageAdapter implements StorageAdapter {
	// biome-ignore lint/suspicious/noExplicitAny: Example implementation - users should replace with PrismaClient type
	constructor(private readonly prisma: any) {
		// Type as 'any' since we don't want to force Prisma as a dependency
		// In real usage, this would be typed as PrismaClient
	}

	async create(data: {
		storage_tier: StorageTier;
		filename: string;
		path: string;
		hot_until: Date | null;
	}): Promise<PhysicalFile> {
		return await this.prisma.physicalFile.create({
			data,
		});
	}

	async findById(id: string | number): Promise<PhysicalFile | null> {
		return await this.prisma.physicalFile.findUnique({
			where: { id },
		});
	}

	async update(
		id: string | number,
		data: {
			storage_tier?: StorageTier;
			path?: string;
			hot_until?: Date | null;
		},
	): Promise<PhysicalFile> {
		return await this.prisma.physicalFile.update({
			where: { id },
			data,
		});
	}

	async delete(id: string | number): Promise<void> {
		await this.prisma.physicalFile.delete({
			where: { id },
		});
	}

	async findExpiredHotFiles(): Promise<PhysicalFile[]> {
		return await this.prisma.physicalFile.findMany({
			where: {
				storage_tier: "HOT",
				hot_until: {
					lte: new Date(),
				},
			},
		});
	}
}
