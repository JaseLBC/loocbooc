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
    manufacturerStats,
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

    // Manufacturer verification stats
    prisma.manufacturerProfile.groupBy({
      by: ["verificationStatus"],
      _count: { _all: true },
    }),
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

  // Parse manufacturer stats
  const mfrByStatus: Record<string, number> = {};
  for (const row of manufacturerStats) {
    mfrByStatus[row.verificationStatus ?? "unverified"] = row._count._all;
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
  let activeBackings = backingStats._count._all;
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
      brands: (userByRole["brand_owner"] ?? 0) + (userByRole["brand_member"] ?? 0),
      manufacturers: userByRole["manufacturer"] ?? 0,
      consumers: userByRole["consumer"] ?? 0,
      admins: userByRole["platform_admin"] ?? 0,
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
      total: Object.values(mfrByStatus).reduce((a, b) => a + b, 0),
      verified: mfrByStatus["verified"] ?? 0,
      pendingVerification: mfrByStatus["pending"] ?? 0,
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

  const where = {
    ...(status ? { status } : {}),
    ...(flaggedOnly ? { flagged: true } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { brand: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

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
    data: rows.map((c) => ({
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
      flagged: (c as unknown as { flagged?: boolean }).flagged ?? false,
      flagReason: (c as unknown as { flagReason?: string | null }).flagReason ?? null,
    })),
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
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      // @ts-expect-error — flagged field may not be in generated types yet
      flagged,
      // @ts-expect-error
      flagReason: reason,
    },
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
  verificationStatus: string;
  ownerEmail: string | null;
  ownerName: string | null;
  moqMin: number;
  createdAt: Date;
  submittedAt: Date | null;
}

export async function listPendingManufacturers(): Promise<PendingManufacturer[]> {
  const profiles = await prisma.manufacturerProfile.findMany({
    where: {
      OR: [
        { verificationStatus: "pending" },
        { verificationStatus: "under_review" },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { email: true, fullName: true } },
    },
  });

  return profiles.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    country: p.country,
    city: p.city,
    specialisations: p.specialisations ?? [],
    certifications: p.certifications ?? [],
    priceTier: p.priceTier,
    verificationStatus: p.verificationStatus ?? "pending",
    ownerEmail: p.user?.email ?? null,
    ownerName: p.user?.fullName ?? null,
    moqMin: p.moqMin,
    createdAt: p.createdAt,
    submittedAt: (p as unknown as { submittedAt?: Date | null }).submittedAt ?? null,
  }));
}

export async function approveManufacturer(manufacturerId: string): Promise<void> {
  await prisma.manufacturerProfile.update({
    where: { id: manufacturerId },
    data: {
      verificationStatus: "verified",
      isVerified: true,
      // @ts-expect-error — verifiedAt may not be in generated types
      verifiedAt: new Date(),
    },
  });
}

export async function rejectManufacturer(
  manufacturerId: string,
  reason: string,
): Promise<void> {
  await prisma.manufacturerProfile.update({
    where: { id: manufacturerId },
    data: {
      verificationStatus: "rejected",
      isVerified: false,
      // @ts-expect-error
      rejectionReason: reason,
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
  suspended: boolean;
  createdAt: Date;
  lastSignInAt: Date | null;
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

  const where = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { fullName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        brandMembers: {
          include: { brand: { select: { name: true } } },
          take: 1,
        },
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
      suspended: (u as unknown as { suspended?: boolean }).suspended ?? false,
      createdAt: u.createdAt,
      lastSignInAt: (u as unknown as { lastSignInAt?: Date | null }).lastSignInAt ?? null,
      brandName: u.brandMembers[0]?.brand?.name ?? null,
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
      // @ts-expect-error — suspended field may not be in generated types
      suspended,
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
