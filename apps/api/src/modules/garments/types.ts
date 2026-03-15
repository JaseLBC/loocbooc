/**
 * Garments module — shared TypeScript types.
 *
 * Naming note: the frontend uses a "UGI" (Unique Garment Identifier) which is
 * a short human-readable code like "LB-ABCD-1234-XY78". Internally the
 * database still uses a cuid primary key. The UGI is stored in Garment.ugi
 * and is the public-facing identifier for all API calls.
 */

export interface GarmentSummary {
  ugi: string;
  id: string;           // internal cuid (kept for DB-join context, not exposed to client)
  brandId: string;
  name: string;
  category: string | null;
  season: string | null;
  sku: string | null;
  description: string | null;
  fabricComposition: string | null;
  fabricPhysics: FabricPhysics | null;
  measurements: GarmentMeasurements | null;
  uploadMethod: string | null;
  status: string;       // maps to GarmentStatus enum in frontend
  hasModel3D: boolean;
  thumbnailUrl: string | null;
  modelUrl: string | null;
  usdzUrl: string | null;
  tryOnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FabricPhysics {
  drape: number;       // 0–100
  stretch: number;     // 0–100
  weight: number;      // 0–100
  breathability: number; // 0–100
  sheen: number;       // 0–100
}

export interface GarmentMeasurements {
  chest?: number;
  waist?: number;
  hem?: number;
  sleeveLength?: number;
  totalLength?: number;
  shoulderWidth?: number;
  notes?: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
  progress?: number;
  detail?: string;
}

export interface ScanStatus {
  ugi: string;
  status: string;
  stages: PipelineStage[];
  estimatedSecondsRemaining?: number;
  errorMessage?: string;
}

export interface BrandStats {
  totalGarments: number;
  garmentsWith3D: number;
  totalTryOns: number;
  lastActivityAt: string | null;
}

// Fabric physics derivation result
export interface FabricPhysicsResult {
  drape: number;
  stretch: number;
  weight: number;
  breathability: number;
  sheen: number;
}
