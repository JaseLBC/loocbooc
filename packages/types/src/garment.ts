/**
 * Garment and SKU entity types.
 * Garments are the base product. SKUs are colour/size variants.
 */

export type GarmentStatus =
  | "draft"
  | "development"
  | "sampling"
  | "production"
  | "retail"
  | "discontinued";

export type SkuStatus = "active" | "discontinued" | "archived";

export type GarmentGender = "womens" | "mens" | "unisex" | "kids";

export interface Garment {
  id: string;
  brandId: string;
  name: string;
  styleCode: string | null;
  category: string | null; // dress, top, trouser, jacket, etc.
  subcategory: string | null;
  gender: GarmentGender | null;
  season: string | null;
  year: number | null;
  description: string | null;
  techPackId: string | null;
  status: GarmentStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SKU {
  id: string;
  garmentId: string;
  skuCode: string;
  colour: string | null;
  colourCode: string | null;
  size: string | null; // XS, S, M, L, XL, 6, 8, 10, etc.
  sizeSystem: string | null; // AU, US, EU, UK, INT
  barcode: string | null;
  targetCost: number | null; // decimal
  actualCost: number | null;
  rrp: number | null;
  weightGrams: number | null;
  status: SkuStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGarmentInput {
  brandId: string;
  name: string;
  styleCode?: string;
  category?: string;
  subcategory?: string;
  gender?: GarmentGender;
  season?: string;
  year?: number;
  description?: string;
  tags?: string[];
}

export interface CreateSkuInput {
  garmentId: string;
  skuCode: string;
  colour?: string;
  colourCode?: string;
  size?: string;
  sizeSystem?: string;
  barcode?: string;
  targetCost?: number;
  rrp?: number;
  weightGrams?: number;
}
