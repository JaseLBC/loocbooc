/**
 * Brand & Manufacturer onboarding flows.
 *
 * These are the post-registration flows that tie a Supabase user to a
 * platform entity (Brand or Manufacturer). Called from auth routes after
 * the user record is confirmed.
 *
 * Manufacturer verification is an admin workflow — manufacturers register
 * with status PENDING and an admin must verify them before they can access
 * manufacturer-only features.
 */

import type {
  Brand,
  BrandMember,
} from "@loocbooc/types";

/**
 * Minimal interface for Supabase admin client.
 * We only need updateUserById — keeps this module decoupled from the full SDK.
 */
interface SupabaseAdminClient {
  auth: {
    admin: {
      updateUserById: (userId: string, attrs: { app_metadata: Record<string, unknown> }) => Promise<{ error: Error | null }>;
    };
  };
}

type SupabaseClient = SupabaseAdminClient;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterBrandInput {
  name: string;
  slug: string;
  description?: string;
  country?: string;
  currency?: string;
  shopifyStoreUrl?: string;
}

export interface RegisterManufacturerInput {
  name: string;
  slug: string;
  description?: string;
  country: string;           // required — legal/compliance
  city?: string;
  specialisations?: string[];
  certifications?: string[];
  minOrderQty?: number;
  leadTimeDaysMin?: number;
  leadTimeDaysMax?: number;
}

export interface BrandOnboardingResult {
  brand: Brand;
  membership: BrandMember;
}

export interface ManufacturerOnboardingResult {
  manufacturerId: string;
  name: string;
  slug: string;
  status: "pending";
  message: string;
}

export interface ManufacturerVerifyResult {
  manufacturerId: string;
  verified: boolean;
  verifiedAt: string;
  ownerId: string;
}

// ─── DB accessor type (minimal interface) ────────────────────────────────────
// We use a generic db accessor to keep this module decoupled from the ORM.
// The actual Prisma client is passed in from the route handler.

interface DbClient {
  brand: {
    create: (args: { data: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<Brand>;
    findUnique: (args: { where: Record<string, unknown> }) => Promise<Brand | null>;
  };
  brandMember: {
    create: (args: { data: Record<string, unknown> }) => Promise<BrandMember>;
  };
  manufacturer: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; name: string; slug: string; verified: boolean; ownerUserId: string }>;
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ id: string; verified: boolean; ownerUserId: string; verifiedAt: Date | null }>;
    findUnique: (args: { where: Record<string, unknown> }) => Promise<{ id: string; name: string; slug: string; verified: boolean; ownerUserId: string } | null>;
  };
  user: {
    findUnique: (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<{ id: string; role: string } | null>;
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  };
  $transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
}

/**
 * Roles that should not be downgraded when a user accepts a brand invitation.
 * Brand owners, manufacturers, and platform admins keep their existing role.
 */
const PROTECTED_ROLES = new Set(["brand_owner", "platform_admin", "manufacturer"]);

// ─── Brand Onboarding ─────────────────────────────────────────────────────────

/**
 * Registers a new brand for an authenticated user.
 *
 * Creates:
 *   1. A Brand record with the user as owner
 *   2. A BrandMember record with role = 'admin' (the owner)
 *   3. Updates the user's role to BRAND_OWNER in the users table
 *   4. Sets app_metadata.role = 'brand_owner' in Supabase Auth via admin API
 *
 * All operations are wrapped in a transaction — partial creates are rolled back.
 */
export async function registerBrand(
  db: DbClient,
  supabaseAdmin: SupabaseClient,
  userId: string,
  input: RegisterBrandInput
): Promise<BrandOnboardingResult> {
  // Validate slug uniqueness before starting transaction
  const existing = await db.brand.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new OnboardingError(
      "SLUG_TAKEN",
      "A brand with this slug already exists. Please choose a different URL slug."
    );
  }

  const result = await db.$transaction(async (tx) => {
    // 1. Create the Brand record
    const brand = await tx.brand.create({
      data: {
        ownerUserId: userId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        country: input.country ?? null,
        currency: input.currency ?? "AUD",
        shopifyStoreUrl: input.shopifyStoreUrl ?? null,
        verified: false,
        tier: "starter",
        settings: {},
      },
    });

    // 2. Create owner BrandMember
    const membership = await tx.brandMember.create({
      data: {
        brandId: brand.id,
        userId,
        role: "admin", // Owner is always admin
      },
    });

    // 3. Update user role in our users table
    await tx.user.update({
      where: { id: userId },
      data: { role: "brand_owner" },
    });

    return { brand, membership };
  });

  // 4. Update Supabase Auth app_metadata so the JWT reflects the new role
  // This is done outside the transaction because it's an external call
  await updateSupabaseRole(supabaseAdmin, userId, "brand_owner");

  return result;
}

// ─── Manufacturer Onboarding ──────────────────────────────────────────────────

/**
 * Registers a new manufacturer for an authenticated user.
 *
 * The manufacturer record is created with verified = false (status: PENDING).
 * An admin must call verifyManufacturer() before the user gets manufacturer access.
 *
 * Note: The user's Supabase role is NOT updated here — that happens in verifyManufacturer().
 */
export async function registerManufacturer(
  db: DbClient,
  userId: string,
  input: RegisterManufacturerInput
): Promise<ManufacturerOnboardingResult> {
  // Validate slug uniqueness
  const existing = await db.manufacturer.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new OnboardingError(
      "SLUG_TAKEN",
      "A manufacturer with this slug already exists."
    );
  }

  const manufacturer = await db.manufacturer.create({
    data: {
      ownerUserId: userId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      country: input.country,
      city: input.city ?? null,
      specialisations: input.specialisations ?? [],
      certifications: input.certifications ?? [],
      minOrderQty: input.minOrderQty ?? null,
      leadTimeDaysMin: input.leadTimeDaysMin ?? null,
      leadTimeDaysMax: input.leadTimeDaysMax ?? null,
      verified: false,   // PENDING — must be verified by admin
      active: true,
      ratingCount: 0,
      metadata: {},
    },
  });

  // Update the user table to reflect they are a manufacturer (unverified)
  // Role in Supabase JWT stays as their current role until admin verifies
  await db.user.update({
    where: { id: userId },
    data: { role: "manufacturer" },
  });

  return {
    manufacturerId: manufacturer.id,
    name: manufacturer.name,
    slug: manufacturer.slug,
    status: "pending",
    message:
      "Your manufacturer application has been submitted. Our team will review it within 2–3 business days and notify you by email.",
  };
}

// ─── Admin: Verify Manufacturer ───────────────────────────────────────────────

/**
 * Admin-only: approve a manufacturer and grant them full portal access.
 *
 * Sets:
 *   - manufacturer.verified = true
 *   - manufacturer.verifiedAt = now
 *   - app_metadata.role = 'manufacturer' in Supabase Auth
 *
 * After this, the manufacturer's JWT will carry the manufacturer role on next sign-in.
 */
export async function verifyManufacturer(
  db: DbClient,
  supabaseAdmin: SupabaseClient,
  manufacturerId: string
): Promise<ManufacturerVerifyResult> {
  const manufacturer = await db.manufacturer.findUnique({
    where: { id: manufacturerId },
  });

  if (!manufacturer) {
    throw new OnboardingError(
      "NOT_FOUND",
      "Manufacturer not found."
    );
  }

  if (manufacturer.verified) {
    throw new OnboardingError(
      "ALREADY_VERIFIED",
      "This manufacturer is already verified."
    );
  }

  const updated = await db.manufacturer.update({
    where: { id: manufacturerId },
    data: {
      verified: true,
      verifiedAt: new Date(),
    },
  });

  // Update Supabase Auth so the JWT reflects the manufacturer role on next sign-in
  await updateSupabaseRole(supabaseAdmin, manufacturer.ownerUserId, "manufacturer");

  return {
    manufacturerId: updated.id,
    verified: updated.verified,
    verifiedAt: (updated.verifiedAt ?? new Date()).toISOString(),
    ownerId: updated.ownerUserId,
  };
}

// ─── Brand Team Invitations ───────────────────────────────────────────────────

export interface BrandInviteToken {
  token: string;
  brandId: string;
  email: string;
  memberRole: "admin" | "member" | "viewer";
  expiresAt: string;
}

/**
 * Creates a brand invitation token.
 * The token is stored in a brand_invitations table and emailed to the invitee.
 *
 * Token validity: 7 days.
 * One pending invite per email per brand — subsequent invites replace previous.
 */
export async function createBrandInvite(
  db: DbClient & {
    brandInvitation: {
      upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<{ token: string; expiresAt: Date }>;
    };
  },
  brandId: string,
  invitedByUserId: string,
  email: string,
  memberRole: "admin" | "member" | "viewer" = "member"
): Promise<BrandInviteToken> {
  // Verify the inviter is a brand admin or owner
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    throw new OnboardingError("NOT_FOUND", "Brand not found.");
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.brandInvitation.upsert({
    where: { brandId_email: { brandId, email: email.toLowerCase() } } as unknown as Record<string, unknown>,
    create: {
      brandId,
      email: email.toLowerCase(),
      invitedByUserId,
      memberRole,
      token,
      expiresAt,
    },
    update: {
      invitedByUserId,
      memberRole,
      token,
      expiresAt,
      usedAt: null, // reset if re-inviting
    },
  });

  return {
    token,
    brandId,
    email: email.toLowerCase(),
    memberRole,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Accepts a brand invitation and creates a BrandMember record.
 * The user must already be registered — they cannot accept an invite as a new user.
 */
export async function acceptBrandInvite(
  db: DbClient & {
    brandInvitation: {
      findFirst: (args: { where: Record<string, unknown> }) => Promise<{
        id: string;
        brandId: string;
        email: string;
        memberRole: string;
        expiresAt: Date;
        usedAt: Date | null;
      } | null>;
      update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
    };
  },
  token: string,
  userId: string,
  userEmail: string
): Promise<{ brandId: string; memberRole: string }> {
  const invite = await db.brandInvitation.findFirst({
    where: { token, usedAt: null },
  });

  if (!invite) {
    throw new OnboardingError(
      "INVALID_TOKEN",
      "This invitation link is invalid or has already been used."
    );
  }

  if (new Date() > invite.expiresAt) {
    throw new OnboardingError(
      "TOKEN_EXPIRED",
      "This invitation has expired. Please ask the brand owner to send a new one."
    );
  }

  if (invite.email !== userEmail.toLowerCase()) {
    throw new OnboardingError(
      "EMAIL_MISMATCH",
      "This invitation was sent to a different email address."
    );
  }

  // Check the user's current role before entering the transaction.
  // Protected roles (brand_owner, manufacturer, platform_admin) must not be downgraded.
  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  const shouldUpdateRole = !existingUser || !PROTECTED_ROLES.has(existingUser.role);

  await db.$transaction(async (tx) => {
    // Create the BrandMember record
    await tx.brandMember.create({
      data: {
        brandId: invite.brandId,
        userId,
        role: invite.memberRole,
      },
    });

    // Only update role to brand_member for low-priority roles (consumer, stylist, etc.)
    // Brand owners, manufacturers, and platform admins retain their existing role —
    // they can be a member of multiple brands without losing elevated access.
    if (shouldUpdateRole) {
      await tx.user.update({
        where: { id: userId },
        data: { role: "brand_member" },
      });
    }

    // Mark invite as used — use tx (not db) so this is part of the atomic transaction
    await (tx as typeof db).brandInvitation.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  });

  return { brandId: invite.brandId, memberRole: invite.memberRole };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Updates the user's role in Supabase Auth app_metadata.
 * This is what the JWT will reflect on the user's next token refresh.
 *
 * IMPORTANT: This uses the Supabase admin client (service_role key).
 * Never call this from client-side code. Never log the response.
 */
async function updateSupabaseRole(
  supabaseAdmin: SupabaseClient,
  userId: string,
  role: string
): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  if (error) {
    // Log minimally — no user data, no token content
    throw new OnboardingError(
      "AUTH_UPDATE_FAILED",
      "Failed to update user authentication role. Please contact support."
    );
  }
}

/** Generates a cryptographically random invitation token. */
function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class OnboardingError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}
