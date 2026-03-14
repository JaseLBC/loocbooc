/**
 * Manufacturer entity types.
 * Manufacturers list their capabilities and receive campaign production requests.
 */

export type ManufacturerPriceTier = "budget" | "mid" | "premium";

export interface Manufacturer {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  country: string; // ISO 3166-1 alpha-2
  city: string | null;
  specialisations: string[]; // woven, knit, denim, leather, etc.
  certifications: string[]; // GOTS, OEKO-TEX, Fair Trade, etc.
  minOrderQty: number | null;
  maxCapacityUnits: number | null; // per month
  leadTimeDaysMin: number | null;
  leadTimeDaysMax: number | null;
  priceTier: ManufacturerPriceTier | null;
  verified: boolean;
  verifiedAt: Date | null;
  ratingAvg: number | null;
  ratingCount: number;
  active: boolean;
  stripeAccountId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateManufacturerInput {
  name: string;
  slug: string;
  country: string;
  city?: string;
  description?: string;
  specialisations?: string[];
  certifications?: string[];
  minOrderQty?: number;
  maxCapacityUnits?: number;
  leadTimeDaysMin?: number;
  leadTimeDaysMax?: number;
  priceTier?: ManufacturerPriceTier;
}

export interface UpdateManufacturerInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  city?: string;
  specialisations?: string[];
  certifications?: string[];
  minOrderQty?: number;
  maxCapacityUnits?: number;
  leadTimeDaysMin?: number;
  leadTimeDaysMax?: number;
  priceTier?: ManufacturerPriceTier;
  active?: boolean;
}
