/**
 * Admin Service — platform oversight for PLATFORM_ADMIN users only.
 *
 * Provides read/write access to the full platform state:
 * - Platform stats (campaigns, users, revenue, backers)
 * - Campaign management (view all, force status, flag/unflag)
 * - Manufacturer verification (approve/reject pending profiles)
 * - User management (view, suspend, role assignment)
 * - Backing oversight (recent activity, dispute handling)
 *
 * All service methods assume the caller has already been authorised
 * as PLATFORM_ADMIN at the route level.
 */

import { prisma } from "@loocbooc/database";

// ─────────────────────────────────────────────
// Platform overview stats
// ─────────────────────────────────────────────

export interface PlatformStats {
  campaigns: {
    total: number;
    active: number;
    moqReached: number;
    funded: number;
    inProduction: number;
    shipped: number;
    completed: number;
    expired: number;
    draft: number;
  };
  users: {
    total: number;
    brands: number;
    manufacturers: number;
    consumers: number;
    admins: number;
    newLast7Days: number;
  };
  backings: {
    total: number;
    active: number;
    refunded: number;
    fulfilled: number;
    totalRevenueCents: number;
    last24hCount: number;
  };
  manufacturers: {
    total: number;
    verified: number;
    pendingVerification: number;
  };
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 86400000);
  const last7d = new Date(now.getTime() - 7 * 86400000);

  const [
    campaignStats,
    userStats,
    backingStats,
    newUserCount,
    last24hBackings,
    verifiedManufacturers,
    pendingManufacturers,
    totalManufacturers,
  ] = await Promise.all([
    // Campaigns by status
    prisma.campaign.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),

    // Users by role
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),

    // Backing aggregates
    prisma.backing.aggregate({
      _count: { _all: true },
      _sum: { depositCents: true },
      where: { status: "active" },
    }),

    // New users in last 7 days
    prisma.user.count({
      where: { createdAt: { gte: last7d } },
    }),

    // Backings in last 24h
    prisma.backing.count({
      where: { createdAt: { gte: last24h } },
    }),

    // Manufacturer verification stats — using isVerified field
    prisma.manufacturerProfile.count({
      where: { isVerified: true },
    }),

    // Pending = not verified and not featured (implicit pending state)
    prisma.manufacturerProfile.count({
      where: { isVerified: false },
    }),

    // Total manufacturers
    prisma.manufacturerProfile.count(),
  ]);

  // Parse campaign stats
  const campaignByStatus: Record<string, number> = {};
  for (const row of campaignStats) {
    campaignByStatus[row.status] = row._count._all;
  }

  // Parse user stats
  const userByRole: Record<string, number> = {};
  for (const row of userStats) {
    userByRole[row.role] = row._count._all;
  }

  // Total backings across all statuses
  const allBackingStats = await prisma.backing.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { depositCents: true },
  });
  let totalBackings = 0;
  let totalRevenueCents = 0;
  let refundedCount = 0;
  let fulfilledCount = 0;
  const activeBackings = backingStats._count._all;
  for (const row of allBackingStats) {
    totalBackings += row._count._all;
    totalRevenueCents += Number(row._sum.depositCents ?? 0);
    if (row.status === "refunded") refundedCount = row._count._all;
    if (row.status === "fulfilled") fulfilledCount = row._count._all;
  }

  return {
    campaigns: {
      total: Object.values(campaignByStatus).reduce((a, b) => a + b, 0),
      active: campaignByStatus["active"] ?? 0,
      moqReached: campaignByStatus["moq_reached"] ?? 0,
      funded: campaignByStatus["funded"] ?? 0,
      inProduction: campaignByStatus["in_production"] ?? 0,
      shipped: campaignByStatus["shipped"] ?? 0,
      completed: campaignByStatus["completed"] ?? 0,
      expired: campaignByStatus["expired"] ?? 0,
      draft: campaignByStatus["draft"] ?? 0,
    },
    users: {
      total: Object.values(userByRole).reduce((a, b) => a + b, 0),
      brands: (userByRole["BRAND_OWNER"] ?? 0) + (userByRole["BRAND_MEMBER"] ?? 0),
      manufacturers: userByRole["MANUFACTURER"] ?? 0,
      consumers: userByRole["CONSUMER"] ?? 0,
      admins: userByRole["PLATFORM_ADMIN"] ?? 0,
    newLast7Days: newUserCount,
    },
    backings: {
      total: totalBackings,
      active: activeBackings,
      refunded: refundedCount,
      fulfilled: fulfilledCount,
      totalRevenueCents,
      last24hCount: last24hBackings,
    },
    manufacturers: {
      total: totalManufacturers,
      verified: verifiedManufacturers,
      pendingVerification: pendingManufacturers,
    },
  };
}

// ─────────────────────────────────────────────
// Campaign management
// ─────────────────────────────────────────────

export interface AdminCampaignRow {
  id: string;
  title: string;
  status: string;
  brandName: string;
  brandId: string;
  currentBackingCount: number;
  moq: number;
  moqReached: boolean;
  backerPriceCents: number;
  currency: string;
  campaignStart: Date;
  campaignEnd: Date;
  createdAt: Date;
  flagged: boolean;
  flagReason: string | null;
}

export interface CampaignListResult {
  data: AdminCampaignRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function listCampaignsAdmin(opts: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  flaggedOnly?: boolean;
}): Promise<CampaignListResult> {
  const { page, limit, status, search, flaggedOnly } = opts;
  const skip = (page - 1) * limit;

  // Build where clause using Prisma's WhereInput structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (status) {
    where.status = status;
  }
  if (flaggedOnly) {
    // Flag state is stored in metadata JSON
    where.metadata = { path: ["adminFlagged"], equals: true };
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { brand: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        brand: { select: { id: true, name: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    data: rows.map((c) => {
      const meta = (c.metadata as Record<string, unknown>) ?? {};
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        brandName: c.brand.name,
        brandId: c.brand.id,
        currentBackingCount: c.currentBackingCount,
        moq: c.moq,
        moqReached: c.moqReached,
        backerPriceCents: c.backerPriceCents,
        currency: c.currency,
        campaignStart: c.campaignStart,
        campaignEnd: c.campaignEnd,
        createdAt: c.createdAt,
        flagged: meta["adminFlagged"] === true,
        flagReason: (meta["adminFlagReason"] as string | null) ?? null,
      };
    }),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function adminFlagCampaign(
  campaignId: string,
  flagged: boolean,
  reason: string | null,
): Promise<void> {
  // Store flag state in the metadata JSON field since Campaign doesn't have dedicated flag columns
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const currentMetadata = (campaign.metadata as Record<string, unknown>) ?? {};
  const newMetadata = {
    ...currentMetadata,
    adminFlagged: flagged,
    adminFlagReason: reason,
    adminFlaggedAt: flagged ? new Date().toISOString() : null,
  };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { metadata: newMetadata },
  });
}

export async function adminForceExpireCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "expired" },
  });
}

// ─────────────────────────────────────────────
// Manufacturer verification
// ─────────────────────────────────────────────

export interface PendingManufacturer {
  id: string;
  displayName: string;
  country: string;
  city: string | null;
  specialisations: string[];
  certifications: string[];
  priceTier: string;
  isVerified: boolean;
  manufacturerId: string;
  moqMin: number;
}

export async function listPendingManufacturers(): Promise<PendingManufacturer[]> {
  // Pending = not yet verified
  const profiles = await prisma.manufacturerProfile.findMany({
    where: {
      isVerified: false,
    },
    orderBy: { moqMin: "asc" }, // Show smallest MOQ first (more accessible to brands)
  });

  return profiles.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    country: p.country,
    city: p.city,
    specialisations: p.specialisations,
    certifications: p.certifications,
    priceTier: p.priceTier,
    isVerified: p.isVerified,
    manufacturerId: p.manufacturerId,
    moqMin: p.moqMin,
  }));
}

export async function approveManufacturer(profileId: string): Promise<void> {
  await prisma.manufacturerProfile.update({
    where: { id: profileId },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
    },
  });
}

export async function rejectManufacturer(
  profileId: string,
  _reason: string,
): Promise<void> {
  // For now, just keep them unverified. In future, we could add a rejection reason field
  // or send an email notification. The reason is logged by the caller.
  await prisma.manufacturerProfile.update({
    where: { id: profileId },
    data: {
      isVerified: false,
      verifiedAt: null,
    },
  });
}

// ─────────────────────────────────────────────
// User management
// ─────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  brandName: string | null;
}

export interface UserListResult {
  data: AdminUserRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function listUsersAdmin(opts: {
  page: number;
  limit: number;
  role?: string;
  search?: string;
}): Promise<UserListResult> {
  const { page, limit, role, search } = opts;
  const skip = (page - 1) * limit;

  // Build where clause using any to bypass exactOptionalPropertyTypes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (role) {
    where.role = role;
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        ownedBrands: { select: { name: true }, take: 1 },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: rows.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      brandName: u.ownedBrands[0]?.name ?? null,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function suspendUser(userId: string, suspended: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: suspended ? "suspended" : "active",
    },
  });
}

// ─────────────────────────────────────────────
// Recent activity feed
// ─────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  type: "backing" | "campaign_created" | "campaign_moq" | "user_signup" | "manufacturer_verified";
  description: string;
  timestamp: Date;
  meta: Record<string, string | number>;
}

export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
  const [recentBackings, recentCampaigns, recentMoq] = await Promise.all([
    prisma.backing.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        campaign: { select: { title: true } },
      },
    }),
    prisma.campaign.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { brand: { select: { name: true } } },
    }),
    prisma.campaign.findMany({
      where: { moqReached: true, moqReachedAt: { not: null } },
      take: limit,
      orderBy: { moqReachedAt: "desc" },
    }),
  ]);

  const items: ActivityItem[] = [
    ...recentBackings.map((b) => ({
      id: `backing:${b.id}`,
      type: "backing" as const,
      description: `New backing for "${b.campaign.title}" — size ${b.size}`,
      timestamp: b.createdAt,
      meta: {
        campaignId: b.campaignId,
        amountCents: b.depositCents,
        currency: b.currency,
      },
    })),
    ...recentCampaigns.map((c) => ({
      id: `campaign:${c.id}`,
      type: "campaign_created" as const,
      description: `New campaign "${c.title}" by ${c.brand.name}`,
      timestamp: c.createdAt,
      meta: { campaignId: c.id, brandId: c.brandId, status: c.status },
    })),
    ...recentMoq
      .filter((c) => c.moqReachedAt)
      .map((c) => ({
        id: `moq:${c.id}`,
        type: "campaign_moq" as const,
        description: `"${c.title}" reached its MOQ goal (${c.moq} backers)`,
        timestamp: c.moqReachedAt!,
        meta: { campaignId: c.id, moq: c.moq },
      })),
  ];

  // Sort by timestamp descending and return the top `limit` items
  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return items.slice(0, limit);
}
