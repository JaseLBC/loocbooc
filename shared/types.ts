/**
 * Loocbooc — Shared TypeScript Type Definitions
 * Version: 1.0.0
 *
 * These types are the contract between:
 *   - API (Python/Pydantic) → Web frontend (Next.js)
 *   - API (Python/Pydantic) → Mobile app (React Native)
 *   - API responses → API client SDK
 *
 * Rules:
 *   - Every API response type must be represented here.
 *   - No `any` types. Use `unknown` and narrow.
 *   - Dates are ISO8601 strings in transit (not Date objects).
 *   - Nullable fields use `T | null`, not `T | undefined`, unless
 *     the field may be absent from the response entirely.
 *
 * When the Python Pydantic schemas change, update this file.
 * CI validates alignment between OpenAPI spec and these types.
 */

// ============================================================
// PRIMITIVE TYPES
// ============================================================

/** ISO 8601 datetime string, e.g. "2026-03-15T09:32:11Z" */
export type ISO8601 = string;

/** ISO 8601 date string, e.g. "2026-03-15" */
export type ISODate = string;

/** UUID v4 string */
export type UUID = string;

/** UGI — Universal Garment Identifier, e.g. "LB-CHRCO-TOP-K8VZ4P-001-X7" */
export type UGI = string;

/** 2-letter ISO 3166-1 alpha-2 country code */
export type CountryCode = string;

/** 3-letter ISO 4217 currency code */
export type CurrencyCode = string;

// ============================================================
// ENUMS
// ============================================================

export enum GarmentCategory {
  Top = 'top',
  Bottom = 'bottom',
  Dress = 'dress',
  Outerwear = 'outerwear',
  Footwear = 'footwear',
  Accessory = 'accessory',
  Underwear = 'underwear',
  Swimwear = 'swimwear',
  Activewear = 'activewear',
  Other = 'other',
}

export enum GarmentGender {
  Womenswear = 'womenswear',
  Menswear = 'menswear',
  Unisex = 'unisex',
  Childrenswear = 'childrenswear',
}

export enum GarmentStatus {
  Draft = 'draft',
  Processing = 'processing',
  Active = 'active',
  Updating = 'updating',
  Error = 'error',
  Archived = 'archived',
  Deleted = 'deleted',
}

export enum InputType {
  CLO3D = 'clo3d',
  MarvelousDesigner = 'marvelous_designer',
  DXFPatterns = 'dxf_patterns',
  Photos12 = 'photos_12',
  VideoScan = 'video_scan',
  MeasurementsOnly = 'measurements_only',
}

export enum VersionChangeType {
  Initial = 'initial',
  PatternUpdate = 'pattern_update',
  FabricChange = 'fabric_change',
  MeasurementCorrection = 'measurement_correction',
  MetadataUpdate = 'metadata_update',
  FullReprocess = 'full_reprocess',
}

export enum AvatarStatus {
  PendingScan = 'pending_scan',
  Processing = 'processing',
  Active = 'active',
  NeedsRescan = 'needs_rescan',
  Deleted = 'deleted',
}

export enum TryOnStatus {
  Pending = 'pending',
  Processing = 'processing',
  Complete = 'complete',
  Failed = 'failed',
}

export enum FitVerdict {
  TooSmall = 'too_small',
  SlightlySmall = 'slightly_small',
  Perfect = 'perfect',
  SlightlyLarge = 'slightly_large',
  TooLarge = 'too_large',
}

export enum MeasurementSource {
  Scan = 'scan',
  Manual = 'manual',
  TapeMeasure = 'tape_measure',
  MLInferred = 'ml_inferred',
}

export enum PhysicsSource {
  Lookup = 'lookup',
  Measured = 'measured',
  MLInferred = 'ml_inferred',
  Calibrated = 'calibrated',
}

export enum ProductionStatus {
  Pending = 'pending',
  Acknowledged = 'acknowledged',
  InProduction = 'in_production',
  Complete = 'complete',
  Cancelled = 'cancelled',
}

export enum UserRole {
  Brand = 'brand',
  Manufacturer = 'manufacturer',
  Consumer = 'consumer',
  Admin = 'admin',
  System = 'system',
}

export enum BrandTier {
  Starter = 'starter',
  Growth = 'growth',
  Enterprise = 'enterprise',
}

export enum IntegrationType {
  CLO3D = 'clo3d',
  MarvelousDesigner = 'marvelous_designer',
  GerberAccuMark = 'gerber_accumark',
  LectraModaris = 'lectra_modaris',
  Tukatech = 'tukatech',
  Optitex = 'optitex',
  CentricPLM = 'centric_plm',
  InforFashion = 'infor_fashion',
  Shopify = 'shopify',
  WooCommerce = 'woocommerce',
  Magento = 'magento',
  CustomWebhook = 'custom_webhook',
}

export enum ScanSessionType {
  AvatarBody = 'avatar_body',
  GarmentPhoto = 'garment_photo',
  GarmentVideo = 'garment_video',
}

export enum GarmentFileType {
  SourcePattern = 'source_pattern',
  SourcePhoto = 'source_photo',
  SourceVideo = 'source_video',
  SourceScan = 'source_scan',
  SourceCLO3D = 'source_clo3d',
  SourceMarvelous = 'source_marvelous',
  SourceDXF = 'source_dxf',
  CareLabelPhoto = 'care_label_photo',
  TechPackPDF = 'tech_pack_pdf',
  ModelLGMT = 'model_lgmt',
  ModelGLB = 'model_glb',
  ModelUSDZ = 'model_usdz',
  Thumbnail512 = 'thumbnail_512',
  Thumbnail1024 = 'thumbnail_1024',
  PhysicsParams = 'physics_params',
  DiffPDF = 'diff_pdf',
}

export enum BodyType {
  Hourglass = 'hourglass',
  Pear = 'pear',
  Apple = 'apple',
  Rectangle = 'rectangle',
  InvertedTriangle = 'inverted_triangle',
}

// ============================================================
// BRAND TYPES
// ============================================================

export interface Brand {
  id: UUID;
  slug: string;
  name: string;
  brand_code: string;
  email: string;
  country_code: CountryCode;
  tier: BrandTier;
  status: 'active' | 'suspended' | 'pending';
  webhook_url: string | null;
  settings: Record<string, unknown>;
  created_at: ISO8601;
  updated_at: ISO8601;
}

export interface BrandSummary {
  id: UUID;
  slug: string;
  name: string;
  brand_code: string;
}

export interface CreateBrandRequest {
  slug: string;
  name: string;
  brand_code: string;
  email: string;
  country_code: CountryCode;
  tier?: BrandTier;
  webhook_url?: string;
}

export interface BrandIntegration {
  id: UUID;
  brand_id: UUID;
  integration_type: IntegrationType;
  config: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  last_sync_at: ISO8601 | null;
  error_message: string | null;
  created_at: ISO8601;
  updated_at: ISO8601;
}

// ============================================================
// API KEY TYPES
// ============================================================

export interface ApiKey {
  id: UUID;
  brand_id: UUID | null;
  key_prefix: string;
  name: string;
  scopes: string[];
  role: UserRole;
  rate_limit_rpm: number;
  expires_at: ISO8601 | null;
  last_used_at: ISO8601 | null;
  created_at: ISO8601;
}

/** Returned only once at creation — the full key is never retrievable again */
export interface ApiKeyCreated extends ApiKey {
  key: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expires_at?: ISO8601;
}

// ============================================================
// FABRIC & PHYSICS TYPES
// ============================================================

export interface FibreComponent {
  fibre: string;        // 'cotton', 'polyester', 'wool', 'silk', etc.
  percentage: number;   // 0-100
}

export interface FabricComposition {
  id: UUID;
  composition_hash: string;
  raw_text: string;
  components: FibreComponent[];
  weave_structure: string | null;
  weight_gsm: number | null;
  finish_treatments: string[];
  created_at: ISO8601;
}

export type FabricCompositionSummary = Pick<
  FabricComposition,
  'id' | 'raw_text' | 'components' | 'weave_structure'
>;

export interface FabricPhysics {
  id: UUID;
  composition_id: UUID;
  tensile_stiffness: number;
  bending_stiffness: number;
  shear_stiffness: number;
  drape_coefficient: number;   // 0 (rigid) to 1 (very drapey)
  stretch_x: number;           // Warp stretch as decimal (e.g. 0.05 = 5%)
  stretch_y: number;           // Weft stretch
  mass_per_m2: number;         // kg/m²
  friction_static: number;
  friction_dynamic: number;
  damping: number;
  source: PhysicsSource;
  confidence: number;          // 0-1
  sample_count: number;
  created_at: ISO8601;
  updated_at: ISO8601;
}

export type FabricPhysicsSummary = Pick<
  FabricPhysics,
  | 'id'
  | 'drape_coefficient'
  | 'stretch_x'
  | 'stretch_y'
  | 'source'
  | 'confidence'
>;

// ============================================================
// GARMENT TYPES
// ============================================================

export interface GarmentModels {
  lgmt_url?: string;
  glb_url?: string;
  usdz_url?: string;
  thumbnail_512?: string;
  thumbnail_1024?: string;
}

export interface Garment {
  id: UUID;
  ugi: UGI;
  brand: BrandSummary;
  current_version: GarmentVersionSummary | null;
  name: string;
  category: GarmentCategory;
  subcategory: string | null;
  gender: GarmentGender | null;
  status: GarmentStatus;
  input_type: InputType;
  composition: FabricCompositionSummary | null;
  physics: FabricPhysicsSummary | null;
  models: GarmentModels;
  dpp_enabled: boolean;
  dpp: DPPSummary | null;
  retail_price: number | null;
  currency: CurrencyCode | null;
  markets: CountryCode[];
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: ISO8601;
  updated_at: ISO8601;
}

export type GarmentSummary = Pick<
  Garment,
  | 'id'
  | 'ugi'
  | 'brand'
  | 'name'
  | 'category'
  | 'status'
  | 'models'
  | 'created_at'
>;

export interface CreateGarmentRequest {
  name: string;
  category: GarmentCategory;
  subcategory?: string;
  gender?: GarmentGender;
  input_type: InputType;
  composition_text?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateGarmentRequest {
  name?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  retail_price?: number;
  currency?: CurrencyCode;
  markets?: CountryCode[];
}

export interface PresignedUpload {
  url: string;          // GCS presigned URL
  fields?: Record<string, string>;  // Additional form fields (for POST uploads)
  gcs_path: string;
  expires_at: ISO8601;
}

export interface GarmentUploadUrls {
  patterns?: PresignedUpload[];
  photos?: PresignedUpload[];
  video?: PresignedUpload;
  care_label?: PresignedUpload;
  tech_pack?: PresignedUpload;
}

export interface CreateGarmentResponse {
  ugi: UGI;
  garment_id: UUID;
  status: GarmentStatus;
  upload_urls: GarmentUploadUrls;
  expires_at: ISO8601;
}

export interface GarmentStatusResponse {
  ugi: UGI;
  status: GarmentStatus;
  progress_percent: number | null;
  current_phase: string | null;
  error: string | null;
  completed_at: ISO8601 | null;
}

export interface SubmitGarmentResponse {
  ugi: UGI;
  job_id: string;
  status: GarmentStatus;
  estimated_seconds: number;
  poll_url: string;
  webhook_url: string | null;
}

// ============================================================
// GARMENT VERSION TYPES
// ============================================================

export interface GarmentVersion {
  id: UUID;
  garment_id: UUID;
  version_number: number;
  change_type: VersionChangeType;
  change_summary: string | null;
  spec_snapshot: Record<string, unknown>;
  is_current: boolean;
  pipeline_job_id: string | null;
  processing_started_at: ISO8601 | null;
  processing_completed_at: ISO8601 | null;
  created_at: ISO8601;
}

export type GarmentVersionSummary = Pick<
  GarmentVersion,
  | 'id'
  | 'version_number'
  | 'change_type'
  | 'change_summary'
  | 'is_current'
  | 'created_at'
>;

export interface CreateVersionRequest {
  change_type: VersionChangeType;
  change_summary: string;
  input_type: InputType;
}

export interface CreateVersionResponse {
  version_id: UUID;
  version_number: number;
  upload_urls: GarmentUploadUrls;
  expires_at: ISO8601;
}

// ============================================================
// GARMENT FILE TYPES
// ============================================================

export interface GarmentFile {
  id: UUID;
  version_id: UUID;
  file_type: GarmentFileType;
  gcs_path: string;
  cdn_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  checksum_sha256: string | null;
  metadata: Record<string, unknown>;
  created_at: ISO8601;
}

// ============================================================
// AVATAR TYPES
// ============================================================

export interface AvatarMeasurements {
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoulder_width_cm: number | null;
  inseam_cm: number | null;
  outseam_cm: number | null;
  neck_cm: number | null;
  arm_length_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  ankle_cm: number | null;
  foot_length_cm: number | null;
  torso_length_cm: number | null;
  rise_cm: number | null;
  body_type: BodyType | null;
  posture_notes: Record<string, unknown> | null;
  /** Per-brand size recommendations: {brand_id: {tops: "M", bottoms: "12"}} */
  recommended_sizes: Record<UUID, Record<string, string>>;
  measurement_source: MeasurementSource;
  measured_at: ISO8601;
}

export interface Avatar {
  avatar_id: UUID;
  display_name: string | null;
  status: AvatarStatus;
  height_cm: number;
  weight_kg: number | null;
  age_range: string | null;
  gender_identity: string | null;
  mesh_url: string | null;
  measurements: AvatarMeasurements | null;
  scan_quality: number | null;
  privacy_level: 'private' | 'shared' | 'anonymous';
  created_at: ISO8601;
  updated_at: ISO8601;
}

export interface CreateAvatarRequest {
  display_name?: string;
  height_cm: number;
  weight_kg?: number;
  gender_identity?: string;
}

export interface CreateAvatarResponse {
  avatar_id: UUID;
  status: AvatarStatus;
  scan_session: {
    session_id: UUID;
    upload_token: string;
    upload_url: string;
    expires_at: ISO8601;
  };
}

export interface ManualMeasurementsRequest {
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  shoulder_width_cm?: number;
  inseam_cm?: number;
  outseam_cm?: number;
  neck_cm?: number;
  arm_length_cm?: number;
  thigh_cm?: number;
  calf_cm?: number;
  ankle_cm?: number;
  foot_length_cm?: number;
  torso_length_cm?: number;
  rise_cm?: number;
}

// ============================================================
// SCAN SESSION TYPES
// ============================================================

export interface ScanSession {
  id: UUID;
  session_type: ScanSessionType;
  entity_id: UUID;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'failed';
  device_type: string | null;
  has_lidar: boolean;
  frames_captured: number | null;
  upload_token: string;
  upload_expires_at: ISO8601;
  error_message: string | null;
  created_at: ISO8601;
  updated_at: ISO8601;
}

/** Sent from mobile app after body scan */
export interface BodyScanUpload {
  scan_session_token: string;
  height_cm: number;
  has_lidar: boolean;
  device_model: string;
  /** point_cloud: multipart file (.ply format) */
  /** joint_positions: multipart file (.json) */
}

export interface BodyScanResponse {
  avatar_id: UUID;
  job_id: string;
  status: 'processing';
  estimated_seconds: number;
}

// ============================================================
// TRY-ON TYPES
// ============================================================

export interface FitScore {
  overall_score: number;           // 0-100
  chest_score: number | null;
  waist_score: number | null;
  hips_score: number | null;
  shoulder_score: number | null;
  sleeve_score: number | null;
  length_score: number | null;
  chest_clearance_mm: number | null;
  waist_clearance_mm: number | null;
  hips_clearance_mm: number | null;
  shoulder_clearance_mm: number | null;
  fit_verdict: FitVerdict;
  size_recommendation: string | null;
  notes: string[];
}

export interface TryOnResult {
  glb_url: string;
  usdz_url: string;
  thumbnail_url: string;
  fit_score: FitScore;
  cached: boolean;
}

export interface TryOn {
  try_on_id: UUID;
  avatar_id: UUID;
  garment_id: UUID;
  ugi: UGI;
  size_requested: string;
  status: TryOnStatus;
  result: TryOnResult | null;
  processing_ms: number | null;
  version_number: number;
  created_at: ISO8601;
  updated_at: ISO8601;
}

export interface CreateTryOnRequest {
  avatar_id: UUID;
  ugi: UGI;
  size: string;
}

export interface CreateTryOnResponse {
  try_on_id: UUID;
  status: TryOnStatus;
  estimated_seconds?: number;
  result?: TryOnResult;  // Present immediately on cache hit
}

export interface TryOnFeedbackRequest {
  rating: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  actual_size_worn?: string;
}

// ============================================================
// OCR AND CARE LABEL TYPES
// ============================================================

export interface CareLabelOCRResponse {
  raw_text: string;
  composition: FibreComponent[];
  confidence: number;              // 0-1
  composition_id: UUID | null;
  physics: FabricPhysicsSummary | null;
}

export interface FabricPhysicsLookupResponse {
  composition_id: UUID;
  physics: FabricPhysics;
  source: PhysicsSource;
  confidence: number;
}

// ============================================================
// DPP (DIGITAL PRODUCT PASSPORT) TYPES
// ============================================================

export interface ManufacturingChainEntry {
  step: string;                    // 'spinning' | 'weaving' | 'dyeing' | 'cut_make_trim' | 'finishing'
  facility_name: string;
  facility_country: CountryCode;
  facility_address?: string;
  certification?: string;
  date_range?: { start: ISODate; end?: ISODate };
}

export interface DPPRecord {
  id: UUID;
  garment_id: UUID;
  ugi: UGI;
  material_composition: FibreComponent[];
  material_origin: Record<string, CountryCode> | null;  // fibre → country of origin
  manufacturing_chain: ManufacturingChainEntry[];
  carbon_footprint_kg: number | null;
  water_usage_litres: number | null;
  certifications: string[];
  care_instructions: string[];
  repair_instructions: string | null;
  disassembly_instructions: string | null;
  recyclability_score: number | null;
  recycling_instructions: string | null;
  eu_compliant: boolean;
  compliance_version: string;
  data_region: string;
  issued_at: ISO8601 | null;
  last_updated_at: ISO8601;
  created_at: ISO8601;
}

export type DPPSummary = Pick<
  DPPRecord,
  'id' | 'eu_compliant' | 'issued_at'
>;

export interface CreateDPPRequest {
  material_composition: FibreComponent[];
  material_origin?: Record<string, CountryCode>;
  manufacturing_chain: ManufacturingChainEntry[];
  certifications?: string[];
  care_instructions?: string[];
  recyclability_score?: number;
  recycling_instructions?: string;
}

export interface CreateDPPResponse {
  dpp_id: UUID;
  eu_compliant: boolean;
  compliance_gaps: string[];
}

// ============================================================
// PRODUCTION RECORD TYPES
// ============================================================

export interface ProductionRecord {
  id: UUID;
  garment_id: UUID;
  version_number: number;
  manufacturer_name: string;
  manufacturer_country: CountryCode;
  factory_code: string | null;
  factory_name: string | null;
  batch_id: string | null;
  units_ordered: number | null;
  units_produced: number | null;
  production_start: ISODate | null;
  production_end: ISODate | null;
  certifications: string[];
  sourcing_chain: Record<string, unknown> | null;
  manufacturer_notified_at: ISO8601 | null;
  manufacturer_acked_at: ISO8601 | null;
  acked_by_name: string | null;
  status: ProductionStatus;
  notes: string | null;
  created_at: ISO8601;
  updated_at: ISO8601;
}

export interface CreateProductionRecordRequest {
  manufacturer_name: string;
  manufacturer_country: CountryCode;
  factory_code?: string;
  factory_name?: string;
  units_ordered?: number;
  production_start?: ISODate;
  certifications?: string[];
}

export interface CreateProductionRecordResponse {
  production_id: UUID;
  manufacturer_notified_at: ISO8601;
  manufacturer_portal_url: string;
}

export interface ManufacturerAcknowledgmentRequest {
  version_number: number;
  acked_by: string;
  notes?: string;
}

// ============================================================
// WEBSOCKET EVENT TYPES
// ============================================================

export interface WSSubscribeMessage {
  action: 'subscribe' | 'unsubscribe';
  channels: string[];   // e.g. ["garment:LB-CHRCO-TOP-K8VZ4P-001-X7", "brand:uuid"]
}

export type WSEvent =
  | WSGarmentUpdatedEvent
  | WSGarmentProcessingCompleteEvent
  | WSTryOnCompleteEvent
  | WSManufacturerAckedEvent
  | WSErrorEvent;

export interface WSGarmentUpdatedEvent {
  event: 'garment_updated';
  ugi: UGI;
  version: number;
  changes_summary: string;
  timestamp: ISO8601;
  tech_pack_url: string;
  diff_url: string | null;
}

export interface WSGarmentProcessingCompleteEvent {
  event: 'garment_processing_complete';
  ugi: UGI;
  status: GarmentStatus;
  model_urls: GarmentModels;
  timestamp: ISO8601;
}

export interface WSTryOnCompleteEvent {
  event: 'try_on_complete';
  try_on_id: UUID;
  fit_score: FitScore;
  result: TryOnResult;
  timestamp: ISO8601;
}

export interface WSManufacturerAckedEvent {
  event: 'manufacturer_acked';
  ugi: UGI;
  version: number;
  acked_by: string;
  timestamp: ISO8601;
}

export interface WSErrorEvent {
  event: 'error';
  code: string;
  message: string;
  timestamp: ISO8601;
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export interface APIError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

export interface ValidationError {
  error: 'validation_error';
  message: string;
  fields: {
    field: string;
    message: string;
  }[];
}

// ============================================================
// AUTH TYPES
// ============================================================

export interface AuthTokenRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  refresh_token: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface JWTClaims {
  sub: UUID;           // user_id
  brand_id?: UUID;
  role: UserRole;
  scopes: string[];
  iat: number;
  exp: number;
}

// ============================================================
// PIPELINE JOB TYPES (internal, for monitoring)
// ============================================================

export type PipelineJobType =
  | 'garment_process'
  | 'garment_update'
  | 'avatar_scan'
  | 'try_on';

export type PipelineJobStatus =
  | 'queued'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'dead_letter';

export interface PipelineJobSummary {
  job_id: string;
  job_type: PipelineJobType;
  entity_id: UUID;              // garment_id or avatar_id
  ugi?: UGI;
  status: PipelineJobStatus;
  input_type?: InputType;
  priority: 1 | 2 | 3;
  retry_count: number;
  enqueued_at: ISO8601;
  started_at: ISO8601 | null;
  completed_at: ISO8601 | null;
  error_message: string | null;
  processing_ms: number | null;
}

// ============================================================
// UGI DECODE TYPE
// ============================================================

/** Parsed components of a UGI string */
export interface UGIParsed {
  raw: UGI;
  prefix: 'LB';
  brand_code: string;
  category_code: string;
  timestamp_b36: string;
  version: number;
  checksum: string;
  valid: boolean;
}

// ============================================================
// MOBILE-SPECIFIC TYPES
// ============================================================

/** ARKit body joint positions (normalized 3D coordinates) */
export interface ARKitJointPositions {
  root: [number, number, number];
  hips_joint: [number, number, number];
  left_upleg_joint: [number, number, number];
  right_upleg_joint: [number, number, number];
  spine_1_joint: [number, number, number];
  spine_2_joint: [number, number, number];
  spine_3_joint: [number, number, number];
  spine_4_joint: [number, number, number];
  spine_5_joint: [number, number, number];
  spine_6_joint: [number, number, number];
  spine_7_joint: [number, number, number];
  left_shoulder_1_joint: [number, number, number];
  right_shoulder_1_joint: [number, number, number];
  left_arm_joint: [number, number, number];
  right_arm_joint: [number, number, number];
  left_forearm_joint: [number, number, number];
  right_forearm_joint: [number, number, number];
  left_hand_joint: [number, number, number];
  right_hand_joint: [number, number, number];
  neck_1_joint: [number, number, number];
  head_joint: [number, number, number];
}

/** Scan quality report from mobile after scan session */
export interface ScanQualityReport {
  overall_quality: number;       // 0-1
  frame_count: number;
  coverage_score: number;        // 0-1, how much of the body was captured
  lighting_score: number;        // 0-1
  motion_blur_frames: number;
  has_lidar_data: boolean;
  lidar_point_density: number | null;  // points per cm²
  recommendations: string[];     // ["Move slower", "Better lighting needed", ...]
}

// ============================================================
// FEATURE FLAGS
// ============================================================

export interface FeatureFlags {
  avatar_scan_enabled: boolean;
  try_on_enabled: boolean;
  dpp_enabled: boolean;
  manufacturer_portal_enabled: boolean;
  ar_quicklook_enabled: boolean;
  wardrobe_enabled: boolean;
  stylist_mode_enabled: boolean;
}

// ============================================================
// WARDROBE TYPES (post-MVP)
// ============================================================

export interface WardrobeItem {
  id: UUID;
  avatar_id: UUID;
  ugi: UGI;
  garment: GarmentSummary;
  size_owned: string;
  purchase_date: ISODate | null;
  purchase_price: number | null;
  purchase_currency: CurrencyCode | null;
  retailer: string | null;
  condition: 'new' | 'excellent' | 'good' | 'fair' | 'poor';
  fit_score: FitScore | null;
  notes: string | null;
  added_at: ISO8601;
}
