/**
 * Styling Marketplace — Service layer.
 *
 * Full business logic for:
 *   - Stylist profile management (create, update, verify, portfolio)
 *   - Brief submission, assignment, and lifecycle management
 *   - Lookbook creation, editing, and publication
 *   - Stylist discovery and search
 *   - Commission calculation and tracking
 *   - Ratings
 *
 * Architecture decisions:
 * - Stylist commission is tracked at LookbookItem level — granular, auditable
 * - Platform fee is always computed server-side (never trust client)
 * - Brief feed shown to stylists excludes PII — only occasion, budget range, style notes, avatar size hint
 * - Stripe Connect payouts are queued to BullMQ — never block HTTP response
 */

import { prisma, Prisma } from "@loocbooc/database";
import { slugify } from "@loocbooc/utils";
import { enqueueJob } from "../../lib/queues.js";
import type {
  StylistSummary,
  StyleBriefSummary,
  StyleBriefLookbookSummary,
  LookbookItemSummary,
  StylistSearchResult,
  BriefFeedItem,
  CommissionSummary,
  CommissionActivity,
  PortfolioItemSummary,
} from "./types.js";
import type {
  CreateStylistInput,
  UpdateStylistInput,
  AddPortfolioItemInput,
  RateStylistInput,
  CreateBriefInput,
  UpdateBriefInput,
  AddLookbookItemInput,
  UpdateLookbookItemInput,
  UpdateLookbookInput,
  StylistSearchInput,
} from "./schema.js";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PLATFORM_FEE_PERCENT = 5; // Platform takes 5% on top of stylist commission

// ─────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────

export class StylingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "StylingError";
  }
}

// ─────────────────────────────────────────────
// Stylist — profile management
// ─────────────────────────────────────────────

/**
 * Register a new stylist profile.
 * One stylist profile per user — enforced by unique constraint.
 */
export async function createStylist(userId: string, input: CreateStylistInput): Promise<StylistSummary> {
  // Check slug availability
  const existing = await prisma.stylist.findFirst({
    where: { OR: [{ userId }, { slug: input.slug }] },
  });

  if (existing) {
    if (existing.userId === userId) {
      throw new StylingError("STYLIST_ALREADY_EXISTS", "You already have a stylist profile.", 409);
    }
    throw new StylingError("SLUG_TAKEN", "That username is already taken.", 409);
  }

  const stylist = await prisma.stylist.create({
    data: {
      userId,
      displayName: input.displayName,
      slug: input.slug,
      bio: input.bio ?? null,
      location: input.location ?? null,
      specialisations: input.specialisations,
      styleKeywords: input.styleKeywords,
      pricePerBriefCents: input.pricePerBriefCents,
      commissionPercent: input.commissionPercent,
      instagramHandle: input.instagramHandle ?? null,
      websiteUrl: input.websiteUrl || null,
    },
    include: { portfolioItems: true },
  });

  return toStylistSummary(stylist, []);
}

/**
 * Update stylist profile fields.
 */
export async function updateStylist(
  stylistId: string,
  userId: string,
  input: UpdateStylistInput,
  isAdmin = false,
): Promise<StylistSummary> {
  const existing = await prisma.stylist.findUnique({
    where: { id: stylistId },
    include: { portfolioItems: true },
  });

  if (!existing) throw new StylingError("NOT_FOUND", "Stylist not found.", 404);
  if (!isAdmin && existing.userId !== userId) throw new StylingError("FORBIDDEN", "Not your profile.", 403);

  const updated = await prisma.stylist.update({
    where: { id: stylistId },
    data: {
      displayName:       input.displayName       ?? undefined,
      bio:               input.bio               ?? undefined,
      location:          input.location          ?? undefined,
      specialisations:   input.specialisations   ?? undefined,
      styleKeywords:     input.styleKeywords     ?? undefined,
      pricePerBriefCents: input.pricePerBriefCents ?? undefined,
      commissionPercent: input.commissionPercent ?? undefined,
      isAvailable:       input.isAvailable       ?? undefined,
      instagramHandle:   input.instagramHandle   ?? undefined,
      websiteUrl:        input.websiteUrl !== undefined ? (input.websiteUrl || null) : undefined,
      avatarUrl:         input.avatarUrl         ?? undefined,
    },
    include: { portfolioItems: true },
  });

  return toStylistSummary(updated, updated.portfolioItems);
}

/**
 * Get a stylist by ID or slug.
 */
export async function getStylist(idOrSlug: string): Promise<StylistSummary> {
  const stylist = await prisma.stylist.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      portfolioItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!stylist) throw new StylingError("NOT_FOUND", "Stylist not found.", 404);

  return toStylistSummary(stylist, stylist.portfolioItems);
}

/**
 * Get a stylist profile by userId (the stylist's own view).
 */
export async function getMyStylistProfile(userId: string): Promise<StylistSummary | null> {
  const stylist = await prisma.stylist.findUnique({
    where: { userId },
    include: { portfolioItems: { orderBy: { sortOrder: "asc" } } },
  });

  if (!stylist) return null;
  return toStylistSummary(stylist, stylist.portfolioItems);
}

/**
 * Search and discover stylists.
 */
export async function searchStylists(input: StylistSearchInput): Promise<StylistSearchResult> {
  const where: Prisma.StylistWhereInput = {
    ...(input.onlyAvailable ? { isAvailable: true } : {}),
    ...(input.onlyVerified ? { verified: true } : {}),
    ...(input.specialisation ? {
      specialisations: { has: input.specialisation },
    } : {}),
    ...(input.maxBudgetCents !== undefined ? {
      pricePerBriefCents: { lte: input.maxBudgetCents },
    } : {}),
    ...(input.search ? {
      OR: [
        { displayName: { contains: input.search, mode: "insensitive" } },
        { bio: { contains: input.search, mode: "insensitive" } },
        { styleKeywords: { has: input.search.toLowerCase() } },
      ],
    } : {}),
  };

  const [stylists, total] = await Promise.all([
    prisma.stylist.findMany({
      where,
      include: { portfolioItems: { take: 4, orderBy: { sortOrder: "asc" } } },
      orderBy: [
        { verified: "desc" },
        { avgRating: { sort: "desc", nulls: "last" } },
        { completedBriefs: "desc" },
      ],
      take: input.limit,
      skip: input.offset,
    }),
    prisma.stylist.count({ where }),
  ]);

  return {
    stylists: stylists.map((s) => toStylistSummary(s, s.portfolioItems)),
    total,
    hasMore: input.offset + stylists.length < total,
  };
}

/**
 * Add a portfolio image to a stylist profile.
 */
export async function addPortfolioItem(
  stylistId: string,
  userId: string,
  input: AddPortfolioItemInput,
): Promise<PortfolioItemSummary> {
  const stylist = await prisma.stylist.findUnique({ where: { id: stylistId } });
  if (!stylist) throw new StylingError("NOT_FOUND", "Stylist not found.", 404);
  if (stylist.userId !== userId) throw new StylingError("FORBIDDEN", "Not your profile.", 403);

  const count = await prisma.stylistPortfolioItem.count({ where: { stylistId } });
  if (count >= 20) throw new StylingError("PORTFOLIO_FULL", "Maximum 20 portfolio images.", 400);

  const item = await prisma.stylistPortfolioItem.create({
    data: {
      stylistId,
      imageUrl: input.imageUrl,
      caption: input.caption ?? null,
      occasion: input.occasion ?? null,
      sortOrder: input.sortOrder,
    },
  });

  return {
    id: item.id,
    imageUrl: item.imageUrl,
    caption: item.caption,
    occasion: item.occasion,
    sortOrder: item.sortOrder,
  };
}

/**
 * Delete a portfolio item.
 */
export async function deletePortfolioItem(
  itemId: string,
  userId: string,
): Promise<void> {
  const item = await prisma.stylistPortfolioItem.findUnique({
    where: { id: itemId },
    include: { stylist: { select: { userId: true } } },
  });

  if (!item) throw new StylingError("NOT_FOUND", "Portfolio item not found.", 404);
  if (item.stylist.userId !== userId) throw new StylingError("FORBIDDEN", "Not your item.", 403);

  await prisma.stylistPortfolioItem.delete({ where: { id: itemId } });
}

/**
 * Admin: verify a stylist.
 */
export async function verifyStylist(stylistId: string): Promise<StylistSummary> {
  const stylist = await prisma.stylist.update({
    where: { id: stylistId },
    data: { verified: true, verifiedAt: new Date() },
    include: { portfolioItems: true },
  });

  return toStylistSummary(stylist, stylist.portfolioItems);
}

/**
 * Rate a stylist after a completed brief.
 */
export async function rateStylist(
  stylistId: string,
  userId: string,
  input: RateStylistInput,
): Promise<void> {
  const stylist = await prisma.stylist.findUnique({ where: { id: stylistId } });
  if (!stylist) throw new StylingError("NOT_FOUND", "Stylist not found.", 404);
  if (stylist.userId === userId) throw new StylingError("CANNOT_RATE_SELF", "You cannot rate yourself.", 400);

  // If briefId provided, verify brief ownership and that it's been accepted
  if (input.briefId) {
    const brief = await prisma.styleBrief.findUnique({ where: { id: input.briefId } });
    if (!brief) throw new StylingError("BRIEF_NOT_FOUND", "Brief not found.", 404);
    if (brief.userId !== userId) throw new StylingError("FORBIDDEN", "Not your brief.", 403);
    if (brief.status !== "accepted" && brief.status !== "closed") {
      throw new StylingError("BRIEF_NOT_COMPLETE", "Can only rate after accepting a lookbook.", 400);
    }
  }

  // Upsert rating (one per user per stylist)
  await prisma.stylistRating.upsert({
    where: { stylistId_userId: { stylistId, userId } },
    create: {
      stylistId,
      userId,
      briefId: input.briefId ?? null,
      rating: input.rating,
      review: input.review ?? null,
    },
    update: {
      rating: input.rating,
      review: input.review ?? null,
      briefId: input.briefId ?? null,
    },
  });

  // Recompute avg rating
  const ratings = await prisma.stylistRating.findMany({
    where: { stylistId },
    select: { rating: true },
  });

  const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  await prisma.stylist.update({
    where: { id: stylistId },
    data: {
      avgRating: new Prisma.Decimal(avg.toFixed(2)),
      ratingCount: ratings.length,
    },
  });
}

// ─────────────────────────────────────────────
// Style briefs — consumer
// ─────────────────────────────────────────────

/**
 * Submit a new style brief.
 * Optionally include a preferred stylist ID to direct the request.
 */
export async function createBrief(userId: string, input: CreateBriefInput): Promise<StyleBriefSummary> {
  let stylistId: string | null = null;
  let status: string = "open";

  if (input.preferredStylistId) {
    const stylist = await prisma.stylist.findUnique({ where: { id: input.preferredStylistId } });
    if (!stylist || !stylist.isAvailable) {
      throw new StylingError("STYLIST_UNAVAILABLE", "That stylist is not currently available.", 400);
    }
    stylistId = stylist.id;
    // Direct request — brief is visible only to that stylist
    status = "open"; // Still open — stylist must accept
  }

  // Resolve avatar info if provided
  let sizeInfo: Record<string, unknown> | null = null;
  if (input.avatarId) {
    const avatar = await prisma.avatar.findUnique({
      where: { id: input.avatarId },
      select: { userId: true, sizeAu: true, fitPreference: true, bodyShape: true },
    });
    if (avatar && avatar.userId === userId) {
      sizeInfo = {
        avatarId: input.avatarId,
        sizeAu: avatar.sizeAu,
        fitPreference: avatar.fitPreference,
        bodyShape: avatar.bodyShape,
      };
    }
  }

  const brief = await prisma.styleBrief.create({
    data: {
      userId,
      title: input.title ?? null,
      budgetMinCents: input.budgetMinCents ?? null,
      budgetMaxCents: input.budgetMaxCents ?? null,
      currency: input.currency,
      occasion: input.occasion,
      styleNotes: input.styleNotes ?? null,
      brandPreferences: input.brandPreferences,
      excludedBrands: input.excludedBrands,
      sizeInfo: (sizeInfo as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      avatarId: input.avatarId ?? null,
      status: status as never,
      stylistId,
      deadline: input.deadline ? new Date(input.deadline) : null,
    },
    include: { stylist: { include: { portfolioItems: { take: 4, orderBy: { sortOrder: "asc" } } } } },
  });

  // Emit event — interested stylists can subscribe
  await enqueueJob("taste-engine", "brief-submitted", { briefId: brief.id });

  return toBriefSummary(brief);
}

/**
 * Update a brief (consumer only, open/assigned status).
 */
export async function updateBrief(
  briefId: string,
  userId: string,
  input: UpdateBriefInput,
): Promise<StyleBriefSummary> {
  const brief = await prisma.styleBrief.findUnique({ where: { id: briefId } });
  if (!brief) throw new StylingError("NOT_FOUND", "Brief not found.", 404);
  if (brief.userId !== userId) throw new StylingError("FORBIDDEN", "Not your brief.", 403);

  if (brief.status !== "open" && brief.status !== "assigned") {
    throw new StylingError("BRIEF_NOT_EDITABLE", "This brief can no longer be edited.", 400);
  }

  const updated = await prisma.styleBrief.update({
    where: { id: briefId },
    data: {
      title:            input.title            ?? undefined,
      budgetMinCents:   input.budgetMinCents   ?? undefined,
      budgetMaxCents:   input.budgetMaxCents   ?? undefined,
      occasion:         input.occasion         ?? undefined,
      styleNotes:       input.styleNotes       ?? undefined,
      brandPreferences: input.brandPreferences ?? undefined,
      excludedBrands:   input.excludedBrands   ?? undefined,
      deadline: input.deadline !== undefined
        ? (input.deadline ? new Date(input.deadline) : null)
        : undefined,
    },
    include: { stylist: { include: { portfolioItems: { take: 4, orderBy: { sortOrder: "asc" } } } } },
  });

  return toBriefSummary(updated);
}

/**
 * Cancel/close a brief (consumer).
 */
export async function closeBrief(briefId: string, userId: string): Promise<void> {
  const brief = await prisma.styleBrief.findUnique({ where: { id: briefId } });
  if (!brief) throw new StylingError("NOT_FOUND", "Brief not found.", 404);
  if (brief.userId !== userId) throw new StylingError("FORBIDDEN", "Not your brief.", 403);

  if (brief.status === "accepted" || brief.status === "closed") {
    throw new StylingError("CANNOT_CLOSE", "This brief is already closed or accepted.", 400);
  }

  await prisma.styleBrief.update({
    where: { id: briefId },
    data: { status: "closed" },
  });
}

/**
 * Accept a lookbook (consumer) — marks brief as accepted.
 */
export async function acceptLookbook(briefId: string, userId: string): Promise<StyleBriefSummary> {
  const brief = await prisma.styleBrief.findUnique({
    where: { id: briefId },
    include: { lookbook: { include: { items: true } }, stylist: { include: { portfolioItems: { take: 4 } } } },
  });

  if (!brief) throw new StylingError("NOT_FOUND", "Brief not found.", 404);
  if (brief.userId !== userId) throw new StylingError("FORBIDDEN", "Not your brief.", 403);
  if (brief.status !== "delivered") {
    throw new StylingError("LOOKBOOK_NOT_DELIVERED", "Lookbook has not been delivered yet.", 400);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.styleBrief.update({
      where: { id: briefId },
      data: { status: "accepted" },
    });
    if (brief.lookbook) {
      await tx.styleBriefLookbook.update({
        where: { id: brief.lookbook.id },
        data: { status: "accepted", acceptedAt: now },
      });
    }
  });

  return toBriefSummary({
    ...brief,
    status: "accepted",
    updatedAt: now,
    lookbook: brief.lookbook ? { ...brief.lookbook, status: "accepted", acceptedAt: now } : null,
  });
}

/**
 * Get consumer's briefs (paginated).
 */
export async function getMyBriefs(
  userId: string,
  opts: { limit?: number; offset?: number; status?: string },
): Promise<StyleBriefSummary[]> {
  const where: Prisma.StyleBriefWhereInput = {
    userId,
    ...(opts.status ? { status: opts.status as never } : {}),
  };

  const briefs = await prisma.styleBrief.findMany({
    where,
    include: {
      stylist: { include: { portfolioItems: { take: 4, orderBy: { sortOrder: "asc" } } } },
      lookbook: { include: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 20,
    skip: opts.offset ?? 0,
  });

  return briefs.map(toBriefSummary);
}

/**
 * Get single brief details (consumer).
 */
export async function getBrief(briefId: string, userId: string): Promise<StyleBriefSummary> {
  const brief = await prisma.styleBrief.findUnique({
    where: { id: briefId },
    include: {
      stylist: { include: { portfolioItems: { take: 4, orderBy: { sortOrder: "asc" } } } },
      lookbook: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!brief) throw new StylingError("NOT_FOUND", "Brief not found.", 404);
  if (brief.userId !== userId && brief.stylistId !== null) {
    // Allow stylist who owns the brief to also fetch
    const stylist = await prisma.stylist.findUnique({ where: { id: brief.stylistId } });
    if (!stylist || stylist.userId !== userId) {
      throw new StylingError("FORBIDDEN", "You do not have access to this brief.", 403);
    }
  } else if (brief.userId !== userId) {
    throw new StylingError("FORBIDDEN", "You do not have access to this brief.", 403);
  }

  return toBriefSummary(brief);
}

// ─────────────────────────────────────────────
// Style briefs — stylist
// ─────────────────────────────────────────────

/**
 * Get open briefs visible to this stylist (the "brief feed").
 * Strips PII — consumer name, contact info never included.
 */
export async function getOpenBriefs(
  stylistId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ briefs: BriefFeedItem[]; total: number }> {
  const where: Prisma.StyleBriefWhereInput = {
    status: "open",
    OR: [
      { stylistId: null },         // Public open brief
      { stylistId },               // Directed to this stylist
    ],
  };

  const [briefs, total] = await Promise.all([
    prisma.styleBrief.findMany({
      where,
      select: {
        id: true,
        title: true,
        occasion: true,
        budgetMinCents: true,
        budgetMaxCents: true,
        currency: true,
        styleNotes: true,
        sizeInfo: true,
        avatarId: true,
        deadline: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 20,
      skip: opts.offset ?? 0,
    }),
    prisma.styleBrief.count({ where }),
  ]);

  const feedItems: BriefFeedItem[] = briefs.map((b) => {
    const sizeInfo = b.sizeInfo as Record<string, unknown> | null;
    const sizeHint = sizeInfo?.sizeAu ? `AU ${String(sizeInfo.sizeAu)}` : null;
    const budgetRange = formatBudgetRange(b.budgetMinCents, b.budgetMaxCents, b.currency);

    return {
      id: b.id,
      title: b.title,
      occasion: b.occasion,
      budgetRange,
      styleNotes: b.styleNotes,
      sizeHint,
      hasAvatar: !!b.avatarId,
      createdAt: b.createdAt.toISOString(),
      deadline: b.deadline?.toISOString() ?? null,
    };
  });

  return { briefs: feedItems, total };
}

/**
 * Stylist accepts a brief — assigns themselves to it.
 */
export async function acceptBrief(briefId: string, stylistUserId: string): Promise<StyleBriefSummary> {
  // Resolve stylist
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "You do not have a stylist profile.", 403);
  if (!stylist.isAvailable) throw new StylingError("NOT_AVAILABLE", "Your profile is currently set to unavailable.", 400);

  const brief = await prisma.styleBrief.findUnique({ where: { id: briefId } });
  if (!brief) throw new StylingError("NOT_FOUND", "Brief not found.", 404);
  if (brief.status !== "open") throw new StylingError("NOT_OPEN", "This brief is no longer open.", 400);

  // If the brief was directed to a specific stylist, only they can accept
  if (brief.stylistId && brief.stylistId !== stylist.id) {
    throw new StylingError("BRIEF_DIRECTED", "This brief was sent to a different stylist.", 403);
  }

  const now = new Date();
  const updated = await prisma.styleBrief.update({
    where: { id: briefId },
    data: {
      stylistId: stylist.id,
      status: "assigned",
      assignedAt: now,
    },
    include: {
      stylist: { include: { portfolioItems: { take: 4, orderBy: { sortOrder: "asc" } } } },
    },
  });

  // Create empty lookbook for the stylist to fill
  await prisma.styleBriefLookbook.create({
    data: {
      briefId,
      stylistId: stylist.id,
      status: "draft",
    },
  });

  // Notify the consumer
  await enqueueJob("taste-engine", "brief-assigned", { briefId, stylistId: stylist.id });

  return toBriefSummary({ ...updated, lookbook: null });
}

/**
 * Stylist marks brief as in-progress (optional status, signals active work).
 */
export async function startWorkOnBrief(briefId: string, stylistUserId: string): Promise<void> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const brief = await prisma.styleBrief.findUnique({ where: { id: briefId } });
  if (!brief || brief.stylistId !== stylist.id) {
    throw new StylingError("FORBIDDEN", "Not your brief.", 403);
  }
  if (brief.status !== "assigned") {
    throw new StylingError("INVALID_STATUS", "Brief must be in 'assigned' status.", 400);
  }

  await prisma.styleBrief.update({
    where: { id: briefId },
    data: { status: "in_progress" },
  });
}

/**
 * Get briefs assigned to this stylist.
 */
export async function getMyStylistBriefs(
  stylistUserId: string,
  opts: { limit?: number; offset?: number; status?: string } = {},
): Promise<StyleBriefSummary[]> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const where: Prisma.StyleBriefWhereInput = {
    stylistId: stylist.id,
    ...(opts.status ? { status: opts.status as never } : {}),
  };

  const briefs = await prisma.styleBrief.findMany({
    where,
    include: {
      lookbook: { include: { items: { orderBy: { sortOrder: "asc" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 20,
    skip: opts.offset ?? 0,
  });

  return briefs.map((b) => toBriefSummary({ ...b, stylist: null }));
}

// ─────────────────────────────────────────────
// Lookbook management — stylist
// ─────────────────────────────────────────────

/**
 * Get the lookbook for a brief (stylist context).
 */
export async function getLookbook(
  briefId: string,
  stylistUserId: string,
): Promise<StyleBriefLookbookSummary> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const lookbook = await prisma.styleBriefLookbook.findUnique({
    where: { briefId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!lookbook) throw new StylingError("NOT_FOUND", "Lookbook not found.", 404);
  if (lookbook.stylistId !== stylist.id) throw new StylingError("FORBIDDEN", "Not your lookbook.", 403);

  return toLookbookSummary(lookbook, lookbook.items);
}

/**
 * Update lookbook metadata (title, notes).
 */
export async function updateLookbook(
  briefId: string,
  stylistUserId: string,
  input: UpdateLookbookInput,
): Promise<StyleBriefLookbookSummary> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const lookbook = await prisma.styleBriefLookbook.findUnique({ where: { briefId } });
  if (!lookbook) throw new StylingError("NOT_FOUND", "Lookbook not found.", 404);
  if (lookbook.stylistId !== stylist.id) throw new StylingError("FORBIDDEN", "Not your lookbook.", 403);
  if (lookbook.status === "accepted" || lookbook.status === "closed") {
    throw new StylingError("LOOKBOOK_LOCKED", "This lookbook can no longer be edited.", 400);
  }

  const updated = await prisma.styleBriefLookbook.update({
    where: { id: lookbook.id },
    data: {
      title: input.title ?? undefined,
      notes: input.notes ?? undefined,
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return toLookbookSummary(updated, updated.items);
}

/**
 * Add an item to a lookbook.
 * Stylist curates products from Loocbooc campaigns or external links.
 */
export async function addLookbookItem(
  briefId: string,
  stylistUserId: string,
  input: AddLookbookItemInput,
): Promise<LookbookItemSummary> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const lookbook = await prisma.styleBriefLookbook.findUnique({ where: { briefId } });
  if (!lookbook) throw new StylingError("NOT_FOUND", "Lookbook not found.", 404);
  if (lookbook.stylistId !== stylist.id) throw new StylingError("FORBIDDEN", "Not your lookbook.", 403);
  if (lookbook.status === "accepted" || lookbook.status === "closed") {
    throw new StylingError("LOOKBOOK_LOCKED", "This lookbook is locked.", 400);
  }

  const count = await prisma.lookbookItem.count({ where: { lookbookId: lookbook.id } });
  if (count >= 30) throw new StylingError("LOOKBOOK_FULL", "Maximum 30 items per lookbook.", 400);

  const item = await prisma.lookbookItem.create({
    data: {
      lookbookId: lookbook.id,
      productName: input.productName,
      brandName: input.brandName,
      priceCents: input.priceCents ?? null,
      currency: input.currency,
      imageUrl: input.imageUrl ?? null,
      externalUrl: input.externalUrl ?? null,
      campaignId: input.campaignId ?? null,
      skuId: input.skuId ?? null,
      stylistNote: input.stylistNote ?? null,
      sortOrder: input.sortOrder,
    },
  });

  return toLookbookItemSummary(item);
}

/**
 * Update a lookbook item.
 */
export async function updateLookbookItem(
  itemId: string,
  stylistUserId: string,
  input: UpdateLookbookItemInput,
): Promise<LookbookItemSummary> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const item = await prisma.lookbookItem.findUnique({
    where: { id: itemId },
    include: { lookbook: true },
  });

  if (!item) throw new StylingError("NOT_FOUND", "Item not found.", 404);
  if (item.lookbook.stylistId !== stylist.id) throw new StylingError("FORBIDDEN", "Not your item.", 403);
  if (item.lookbook.status === "accepted" || item.lookbook.status === "closed") {
    throw new StylingError("LOOKBOOK_LOCKED", "This lookbook is locked.", 400);
  }

  const updated = await prisma.lookbookItem.update({
    where: { id: itemId },
    data: {
      productName: input.productName ?? undefined,
      brandName:   input.brandName   ?? undefined,
      priceCents:  input.priceCents  !== undefined ? (input.priceCents ?? null) : undefined,
      imageUrl:    input.imageUrl    !== undefined ? (input.imageUrl ?? null) : undefined,
      externalUrl: input.externalUrl !== undefined ? (input.externalUrl ?? null) : undefined,
      stylistNote: input.stylistNote !== undefined ? (input.stylistNote ?? null) : undefined,
      sortOrder:   input.sortOrder   ?? undefined,
    },
  });

  return toLookbookItemSummary(updated);
}

/**
 * Remove an item from a lookbook.
 */
export async function removeLookbookItem(itemId: string, stylistUserId: string): Promise<void> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const item = await prisma.lookbookItem.findUnique({
    where: { id: itemId },
    include: { lookbook: true },
  });

  if (!item) throw new StylingError("NOT_FOUND", "Item not found.", 404);
  if (item.lookbook.stylistId !== stylist.id) throw new StylingError("FORBIDDEN", "Not your item.", 403);

  await prisma.lookbookItem.delete({ where: { id: itemId } });
}

/**
 * Publish a lookbook — delivers it to the consumer.
 * Brief status transitions to 'delivered'.
 */
export async function publishLookbook(briefId: string, stylistUserId: string): Promise<StyleBriefLookbookSummary> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const lookbook = await prisma.styleBriefLookbook.findUnique({
    where: { briefId },
    include: { items: true },
  });

  if (!lookbook) throw new StylingError("NOT_FOUND", "Lookbook not found.", 404);
  if (lookbook.stylistId !== stylist.id) throw new StylingError("FORBIDDEN", "Not your lookbook.", 403);
  if (lookbook.status !== "draft") throw new StylingError("ALREADY_PUBLISHED", "Lookbook is already published.", 400);
  if (lookbook.items.length < 1) {
    throw new StylingError("EMPTY_LOOKBOOK", "Add at least one item before publishing.", 400);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.styleBriefLookbook.update({
      where: { id: lookbook.id },
      data: { status: "published", publishedAt: now },
    });
    await tx.styleBrief.update({
      where: { id: briefId },
      data: { status: "delivered" },
    });
  });

  // Notify the consumer
  await enqueueJob("taste-engine", "lookbook-delivered", { briefId, lookbookId: lookbook.id });

  return toLookbookSummary(
    { ...lookbook, status: "published", publishedAt: now, updatedAt: now },
    lookbook.items,
  );
}

// ─────────────────────────────────────────────
// Commission tracking
// ─────────────────────────────────────────────

/**
 * Record a purchase of a lookbook item (called from Back It checkout / order completion).
 * Computes the commission and queues a payout job.
 */
export async function recordLookbookPurchase(
  lookbookItemId: string,
  orderId: string,
): Promise<void> {
  const item = await prisma.lookbookItem.findUnique({
    where: { id: lookbookItemId },
    include: {
      lookbook: {
        include: { stylist: true },
      },
    },
  });

  if (!item) return; // Item may have been removed — silently skip
  if (item.purchasedAt) return; // Already recorded — idempotency guard

  const now = new Date();
  await prisma.lookbookItem.update({
    where: { id: lookbookItemId },
    data: { purchasedAt: now, purchaseOrderId: orderId },
  });

  if (!item.priceCents || !item.lookbook.stylist.stripeAccountId) return;

  // Compute commission
  const stylistCommissionPercent = item.lookbook.stylist.commissionPercent;
  const commissionCents = Math.round((item.priceCents * stylistCommissionPercent) / 100);
  const platformFeeCents = Math.round((item.priceCents * PLATFORM_FEE_PERCENT) / 100);

  // Queue Stripe Connect payout to stylist
  await enqueueJob("email-notification", "stylist-commission-payout", {
    stylistStripeAccountId: item.lookbook.stylist.stripeAccountId,
    stylistId: item.lookbook.stylistId,
    lookbookItemId,
    orderId,
    commissionCents,
    platformFeeCents,
    currency: item.currency,
  });

  // Increment completed briefs count if this brief is now fully purchased
  // (at least half items purchased = brief considered complete)
  const allItems = await prisma.lookbookItem.findMany({
    where: { lookbookId: item.lookbookId },
    select: { purchasedAt: true },
  });
  const purchasedCount = allItems.filter((i) => i.purchasedAt).length;
  if (purchasedCount >= Math.ceil(allItems.length / 2)) {
    await prisma.stylist.update({
      where: { id: item.lookbook.stylistId },
      data: { completedBriefs: { increment: 1 } },
    });
  }
}

/**
 * Get commission summary for a stylist.
 */
export async function getStylistCommissions(stylistUserId: string): Promise<CommissionSummary> {
  const stylist = await prisma.stylist.findUnique({ where: { userId: stylistUserId } });
  if (!stylist) throw new StylingError("NOT_A_STYLIST", "No stylist profile.", 403);

  const purchasedItems = await prisma.lookbookItem.findMany({
    where: {
      lookbook: { stylistId: stylist.id },
      purchasedAt: { not: null },
      priceCents: { not: null },
    },
    include: { lookbook: true },
    orderBy: { purchasedAt: "desc" },
    take: 50,
  });

  const commissionPercent = stylist.commissionPercent;

  let totalEarnedCents = 0;
  let pendingCents = 0;
  let paidOutCents = 0;

  const recentActivity: CommissionActivity[] = [];

  for (const item of purchasedItems) {
    const commissionCents = Math.round(((item.priceCents ?? 0) * commissionPercent) / 100);
    totalEarnedCents += commissionCents;

    if (item.commissionPaidAt) {
      paidOutCents += commissionCents;
    } else {
      pendingCents += commissionCents;
    }

    if (recentActivity.length < 10) {
      recentActivity.push({
        date: item.purchasedAt!.toISOString(),
        productName: item.productName,
        brandName: item.brandName,
        purchasePriceCents: item.priceCents ?? 0,
        commissionCents,
        status: item.commissionPaidAt ? "paid" : "earned",
      });
    }
  }

  return {
    stylistId: stylist.id,
    totalEarnedCents,
    pendingCents,
    paidOutCents,
    commissionPercent,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    recentActivity,
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

type StylistRecord = {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  specialisations: string[];
  styleKeywords: string[];
  pricePerBriefCents: number;
  commissionPercent: number;
  verified: boolean;
  isAvailable: boolean;
  instagramHandle: string | null;
  websiteUrl: string | null;
  completedBriefs: number;
  avgRating: Prisma.Decimal | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type PortfolioRecord = {
  id: string;
  imageUrl: string;
  caption: string | null;
  occasion: string | null;
  sortOrder: number;
};

function toStylistSummary(stylist: StylistRecord, portfolioItems: PortfolioRecord[]): StylistSummary {
  return {
    id: stylist.id,
    userId: stylist.userId,
    displayName: stylist.displayName,
    slug: stylist.slug,
    bio: stylist.bio,
    avatarUrl: stylist.avatarUrl,
    location: stylist.location,
    specialisations: stylist.specialisations,
    styleKeywords: stylist.styleKeywords,
    pricePerBriefCents: stylist.pricePerBriefCents,
    commissionPercent: stylist.commissionPercent,
    verified: stylist.verified,
    isAvailable: stylist.isAvailable,
    instagramHandle: stylist.instagramHandle,
    websiteUrl: stylist.websiteUrl,
    completedBriefs: stylist.completedBriefs,
    avgRating: stylist.avgRating ? Number(stylist.avgRating) : null,
    ratingCount: stylist.ratingCount,
    portfolioItems: portfolioItems.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: p.caption,
      occasion: p.occasion,
      sortOrder: p.sortOrder,
    })),
    createdAt: stylist.createdAt.toISOString(),
  };
}

function toBriefSummary(brief: {
  id: string;
  userId: string;
  title: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  occasion: string[];
  styleNotes: string | null;
  brandPreferences: string[];
  excludedBrands: string[];
  sizeInfo: unknown;
  avatarId: string | null;
  status: string;
  stylistId: string | null;
  assignedAt: Date | null;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stylist?: (StylistRecord & { portfolioItems: PortfolioRecord[] }) | null;
  lookbook?: {
    id: string;
    briefId: string;
    stylistId: string;
    title: string | null;
    notes: string | null;
    status: string;
    publishedAt: Date | null;
    acceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items?: LookbookItemRecord[];
  } | null;
}): StyleBriefSummary {
  return {
    id: brief.id,
    userId: brief.userId,
    title: brief.title,
    budgetMinCents: brief.budgetMinCents,
    budgetMaxCents: brief.budgetMaxCents,
    currency: brief.currency,
    occasion: brief.occasion,
    styleNotes: brief.styleNotes,
    brandPreferences: brief.brandPreferences,
    excludedBrands: brief.excludedBrands,
    sizeInfo: (brief.sizeInfo as Record<string, unknown>) ?? null,
    avatarId: brief.avatarId,
    status: brief.status as import("./types.js").BriefStatus,
    stylistId: brief.stylistId,
    assignedAt: brief.assignedAt?.toISOString() ?? null,
    deadline: brief.deadline?.toISOString() ?? null,
    hasLookbook: !!brief.lookbook,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt.toISOString(),
    stylist: brief.stylist ? toStylistSummary(brief.stylist, brief.stylist.portfolioItems) : null,
    lookbook: brief.lookbook
      ? toLookbookSummary(brief.lookbook, brief.lookbook.items ?? [])
      : null,
  };
}

type LookbookItemRecord = {
  id: string;
  productName: string;
  brandName: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  externalUrl: string | null;
  campaignId: string | null;
  skuId: string | null;
  stylistNote: string | null;
  sortOrder: number;
  purchasedAt: Date | null;
  createdAt: Date;
};

function toLookbookItemSummary(item: LookbookItemRecord): LookbookItemSummary {
  return {
    id: item.id,
    productName: item.productName,
    brandName: item.brandName,
    priceCents: item.priceCents,
    currency: item.currency,
    imageUrl: item.imageUrl,
    externalUrl: item.externalUrl,
    campaignId: item.campaignId,
    skuId: item.skuId,
    stylistNote: item.stylistNote,
    sortOrder: item.sortOrder,
    purchasedAt: item.purchasedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}

function toLookbookSummary(
  lookbook: {
    id: string;
    briefId: string;
    stylistId: string;
    title: string | null;
    notes: string | null;
    status: string;
    publishedAt: Date | null;
    acceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  items: LookbookItemRecord[],
): StyleBriefLookbookSummary {
  const totalValueCents = items.reduce((sum, i) => sum + (i.priceCents ?? 0), 0);
  const purchasedCount = items.filter((i) => i.purchasedAt).length;

  return {
    id: lookbook.id,
    briefId: lookbook.briefId,
    stylistId: lookbook.stylistId,
    title: lookbook.title,
    notes: lookbook.notes,
    status: lookbook.status as import("./types.js").LookbookStatus,
    publishedAt: lookbook.publishedAt?.toISOString() ?? null,
    acceptedAt: lookbook.acceptedAt?.toISOString() ?? null,
    items: items.map(toLookbookItemSummary),
    totalItems: items.length,
    totalValueCents,
    purchasedCount,
    createdAt: lookbook.createdAt.toISOString(),
    updatedAt: lookbook.updatedAt.toISOString(),
  };
}

function formatBudgetRange(
  minCents: number | null,
  maxCents: number | null,
  currency: string,
): string | null {
  if (!minCents && !maxCents) return null;
  const fmt = (c: number) => `$${Math.round(c / 100)}`;
  if (minCents && maxCents) return `${fmt(minCents)}–${fmt(maxCents)} ${currency}`;
  if (minCents) return `${fmt(minCents)}+ ${currency}`;
  if (maxCents) return `Up to ${fmt(maxCents)} ${currency}`;
  return null;
}
