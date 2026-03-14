/**
 * Universal Avatar types.
 * Stores body measurements and rendered avatar assets per user.
 */

export type BodyShape =
  | "hourglass"
  | "pear"
  | "apple"
  | "rectangle"
  | "inverted_triangle";

export type FitPreference = "slim" | "regular" | "relaxed" | "oversized";

export type MeasurementMethod = "manual" | "scan" | "ai_photo";

export interface Avatar {
  id: string;
  userId: string;
  nickname: string | null;

  // Body measurements in cm
  height: number | null;
  weightKg: number | null;
  bust: number | null;
  waist: number | null;
  hips: number | null;
  inseam: number | null;
  shoulderWidth: number | null;
  sleeveLength: number | null;
  neck: number | null;
  chest: number | null;
  thigh: number | null;
  rise: number | null;

  bodyShape: BodyShape | null;
  fitPreference: FitPreference | null;

  // Rendered assets
  avatar3dUrl: string | null;  // S3 path to .glb avatar mesh
  avatarImgUrl: string | null; // S3 path to rendered PNG

  // Sizing per system
  sizeAu: string | null;
  sizeUs: string | null;
  sizeEu: string | null;

  measurementMethod: MeasurementMethod | null;
  confidenceScore: number | null; // 0–1, accuracy of measurements

  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvatarMeasurements {
  height?: number;
  weightKg?: number;
  bust?: number;
  waist?: number;
  hips?: number;
  inseam?: number;
  shoulderWidth?: number;
  sleeveLength?: number;
  neck?: number;
  chest?: number;
  thigh?: number;
  rise?: number;
}

export interface AvatarFitResult {
  id: string;
  avatarId: string;
  skuId: string;
  fitScore: number;            // 0–1 composite fit score
  fitNotes: Record<string, number> | null; // per-measurement deltas
  recommendedSize: string | null;
  renderUrl: string | null;    // S3 path to avatar wearing this garment
  createdAt: Date;
}

export interface CreateAvatarInput {
  nickname?: string;
  measurements: AvatarMeasurements;
  bodyShape?: BodyShape;
  fitPreference?: FitPreference;
  measurementMethod?: MeasurementMethod;
}
