/**
 * Storage tier enumeration
 */
export enum StorageTier {
	HOT = "HOT",
	COLD = "COLD",
}

/**
 * Normalize storage tier value to enum
 * Accepts both enum and string literals for compatibility with Prisma
 */
export function normalizeStorageTier(tier: StorageTier | "HOT" | "COLD"): StorageTier {
	return tier === "HOT" ? StorageTier.HOT : StorageTier.COLD;
}

/**
 * Validate if a value is a valid storage tier
 */
export function isValidStorageTier(value: unknown): value is StorageTier | "HOT" | "COLD" {
	return value === "HOT" || value === "COLD" || value === StorageTier.HOT || value === StorageTier.COLD;
}
