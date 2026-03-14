/**
 * Auth types — RBAC roles, permissions matrix, and auth-related request/response shapes.
 *
 * The platform has six distinct roles. A user has exactly one role at the platform level.
 * Brand-level access (owner vs member vs viewer) is handled separately via BrandMember.role.
 *
 * Architecture ref: §7.2 and §3.3 (Shared Infrastructure — Auth service)
 */

// ─── Role Definitions ────────────────────────────────────────────────────────

export enum UserRole {
  CONSUMER = "consumer",           // Shoppers, backing campaigns, avatar
  BRAND_OWNER = "brand_owner",     // Full brand admin access
  BRAND_MEMBER = "brand_member",   // Limited brand access (garment techs, etc.)
  MANUFACTURER = "manufacturer",   // Manufacturer portal access
  STYLIST = "stylist",             // Styling marketplace access
  PLATFORM_ADMIN = "platform_admin", // Loocbooc internal admin
}

// Union type alias for convenience alongside the enum
export type UserRoleType =
  | "consumer"
  | "brand_owner"
  | "brand_member"
  | "manufacturer"
  | "stylist"
  | "platform_admin";

// ─── Permission Actions ───────────────────────────────────────────────────────

/**
 * Fine-grained permission actions per module.
 * Format: MODULE:ACTION
 */
export type Permission =
  // Back It — Campaign management
  | "back_it:campaign:create"
  | "back_it:campaign:read"
  | "back_it:campaign:update"
  | "back_it:campaign:publish"
  | "back_it:campaign:cancel"
  | "back_it:campaign:analytics"
  | "back_it:campaign:list_backings"
  // Back It — Consumer backing
  | "back_it:backing:create"
  | "back_it:backing:cancel"
  | "back_it:backing:read_own"
  // Production Tool
  | "production:tech_pack:create"
  | "production:tech_pack:read"
  | "production:tech_pack:update"
  | "production:tech_pack:delete"
  | "production:garment:create"
  | "production:garment:update"
  // Manufacturer Marketplace
  | "manufacturers:profile:create"
  | "manufacturers:profile:update"
  | "manufacturers:profile:read"
  | "manufacturers:profile:verify"  // admin only
  | "manufacturers:notifications:receive"
  // Universal Avatar
  | "avatar:create"
  | "avatar:update"
  | "avatar:read_own"
  | "avatar:read_any"              // admin only
  // Styling Marketplace
  | "styling:brief:create"
  | "styling:brief:read_own"
  | "styling:brief:assign"         // stylist only
  | "styling:lookbook:create"
  | "styling:lookbook:read"
  | "styling:recommendation:accept"
  // Retail Platform
  | "retail:product:create"
  | "retail:product:update"
  | "retail:product:list"
  | "retail:order:create"
  | "retail:order:read_own"
  | "retail:order:read_brand"
  // Production Intelligence (PLM)
  | "plm:pipeline:read"
  | "plm:pipeline:update"
  | "plm:pipeline:read_all"        // admin only
  // Fashion Intelligence
  | "intelligence:reports:read"
  | "intelligence:trends:read"
  | "intelligence:aggregate:read_all" // admin only
  // User & Brand Management
  | "auth:users:read_any"          // admin only
  | "auth:users:suspend"           // admin only
  | "auth:brand:manage_members"
  | "auth:brand:invite_member"
  | "auth:brand:read_own";

// ─── Permissions Matrix ───────────────────────────────────────────────────────

/**
 * Complete permissions matrix — what each role can do.
 * Evaluated in order: explicit deny > explicit grant > default deny.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.CONSUMER]: [
    "back_it:campaign:read",
    "back_it:backing:create",
    "back_it:backing:cancel",
    "back_it:backing:read_own",
    "avatar:create",
    "avatar:update",
    "avatar:read_own",
    "styling:brief:create",
    "styling:brief:read_own",
    "styling:lookbook:read",
    "styling:recommendation:accept",
    "retail:product:list",
    "retail:order:create",
    "retail:order:read_own",
    "manufacturers:profile:read",
  ],

  [UserRole.BRAND_OWNER]: [
    // Everything a brand member can do, plus ownership-level actions
    "back_it:campaign:create",
    "back_it:campaign:read",
    "back_it:campaign:update",
    "back_it:campaign:publish",
    "back_it:campaign:cancel",
    "back_it:campaign:analytics",
    "back_it:campaign:list_backings",
    "production:tech_pack:create",
    "production:tech_pack:read",
    "production:tech_pack:update",
    "production:tech_pack:delete",
    "production:garment:create",
    "production:garment:update",
    "retail:product:create",
    "retail:product:update",
    "retail:product:list",
    "retail:order:read_brand",
    "plm:pipeline:read",
    "plm:pipeline:update",
    "intelligence:reports:read",
    "intelligence:trends:read",
    "manufacturers:profile:read",
    "auth:brand:manage_members",
    "auth:brand:invite_member",
    "auth:brand:read_own",
  ],

  [UserRole.BRAND_MEMBER]: [
    // Read + create, no publish/cancel/delete — gated further by BrandMember.role
    "back_it:campaign:read",
    "back_it:campaign:analytics",
    "back_it:campaign:list_backings",
    "production:tech_pack:create",
    "production:tech_pack:read",
    "production:tech_pack:update",
    "production:garment:create",
    "production:garment:update",
    "retail:product:list",
    "retail:order:read_brand",
    "plm:pipeline:read",
    "manufacturers:profile:read",
    "auth:brand:read_own",
  ],

  [UserRole.MANUFACTURER]: [
    "manufacturers:profile:create",
    "manufacturers:profile:update",
    "manufacturers:profile:read",
    "manufacturers:notifications:receive",
    "production:tech_pack:read",  // read-only, for RFQ responses
    "plm:pipeline:read",          // read-only, own pipelines
    "plm:pipeline:update",        // update own production stages
  ],

  [UserRole.STYLIST]: [
    "styling:brief:read_own",
    "styling:brief:assign",
    "styling:lookbook:create",
    "styling:lookbook:read",
    "retail:product:list",
    "avatar:read_own",            // own avatar for profile photo
    "manufacturers:profile:read",
  ],

  [UserRole.PLATFORM_ADMIN]: [
    // Full access — explicit list so it's auditable
    "back_it:campaign:create",
    "back_it:campaign:read",
    "back_it:campaign:update",
    "back_it:campaign:publish",
    "back_it:campaign:cancel",
    "back_it:campaign:analytics",
    "back_it:campaign:list_backings",
    "back_it:backing:create",
    "back_it:backing:cancel",
    "back_it:backing:read_own",
    "production:tech_pack:create",
    "production:tech_pack:read",
    "production:tech_pack:update",
    "production:tech_pack:delete",
    "production:garment:create",
    "production:garment:update",
    "manufacturers:profile:create",
    "manufacturers:profile:update",
    "manufacturers:profile:read",
    "manufacturers:profile:verify",
    "manufacturers:notifications:receive",
    "avatar:create",
    "avatar:update",
    "avatar:read_own",
    "avatar:read_any",
    "styling:brief:create",
    "styling:brief:read_own",
    "styling:brief:assign",
    "styling:lookbook:create",
    "styling:lookbook:read",
    "styling:recommendation:accept",
    "retail:product:create",
    "retail:product:update",
    "retail:product:list",
    "retail:order:create",
    "retail:order:read_own",
    "retail:order:read_brand",
    "plm:pipeline:read",
    "plm:pipeline:update",
    "plm:pipeline:read_all",
    "intelligence:reports:read",
    "intelligence:trends:read",
    "intelligence:aggregate:read_all",
    "auth:users:read_any",
    "auth:users:suspend",
    "auth:brand:manage_members",
    "auth:brand:invite_member",
    "auth:brand:read_own",
  ],
} as const;

// ─── Permission Check Utility ─────────────────────────────────────────────────

/**
 * Returns true if the given role has the requested permission.
 * Use this in route guards and middleware — never inline role string comparisons.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
}

/**
 * Returns true if the given role has ALL of the requested permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Returns true if the given role has ANY of the requested permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────

/**
 * Shape of the decoded Supabase JWT payload (app_metadata + user_metadata).
 * Supabase stores custom claims in app_metadata for server-set values.
 */
export interface SupabaseJwtPayload {
  sub: string;           // user UUID
  email: string;
  role: string;          // Supabase's internal role (authenticated, anon, service_role)
  iat: number;
  exp: number;
  app_metadata: {
    role: UserRoleType;  // our platform role, set via admin API on registration
    provider?: string;
    providers?: string[];
  };
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
}

/**
 * Normalised user context attached to every authenticated Fastify request.
 */
export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
}

// ─── Auth Request/Response Shapes ────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
  displayName?: string;
  role?: UserRoleType;  // defaults to 'consumer' if not provided
}

export interface RegisterResponse {
  userId: string;
  email: string;
  role: UserRoleType;
  message: string;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    role: UserRoleType;
    createdAt: string;
  };
  brands?: Array<{
    id: string;
    name: string;
    slug: string;
    memberRole: string;
  }>;
  manufacturer?: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    status: "pending" | "verified" | "rejected";
  } | null;
}

export interface UpdateProfileInput {
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface BrandInviteInput {
  email: string;
  brandId: string;
  memberRole?: "admin" | "member" | "viewer";
}

export interface AcceptBrandInviteInput {
  token: string;
}

// ─── Service-to-Service Auth ──────────────────────────────────────────────────

/**
 * Internal API calls between Loocbooc services use a shared secret
 * in the Authorization header: `Bearer INTERNAL:<secret>`.
 * This is validated in the auth plugin before JWT validation.
 */
export interface ServiceAuthContext {
  isServiceCall: true;
  serviceName: string;
}

export type AuthenticatedContext = RequestUser | ServiceAuthContext;

export function isServiceCall(ctx: AuthenticatedContext): ctx is ServiceAuthContext {
  return "isServiceCall" in ctx && ctx.isServiceCall === true;
}
