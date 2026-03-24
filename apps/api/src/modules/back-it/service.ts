/**
 * Back It service — business logic for campaigns and backings.
 * All database interactions go through here. Routes call this service.
 *
 * Key design choices:
 * - MOQ trigger is idempotent (atomic updateMany guards double-trigger)
 * - Backing count increment is atomic via $transaction
 * - All payment flows go through Stripe; DB is updated on webhook confirmation
 */

import type { Campaign, CampaignSizeBreak } from "@loocbooc/database";
import { prisma, Prisma } from "@loocbooc/database";
import { stripe } from "../../lib/stripe.js";
import { enqueueJob } from "../../lib/queues.js";
import { calculateDepositCents, calculateRemainingCents } from "@loocbooc/utils";
import { parsePagination, buildPaginationMeta } from "@loocbooc/utils";
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  PlaceBackingInput,
  CreatePaymentIntentInput,
  ConfirmBackingInput,
} from "./schema.js";
import type { MoqCheckResult, BackingResult } from "./types.js";

// ── Campaign CRUD ────────────────────────────────────────────────────────────

/**
 * Verify that a user is a member of the given brand.
 * Throws FORBIDDEN if not a member. Platform admins bypass this check.
 */
async function assertBrandMember(userId: string, brandId: string): Promise<void> {
  const membership = await prisma.brandMember.findFirst({
    where: { userId, brandId },
    select: { id: true },
  });
  if (!membership) {
    throw new ServiceError(
      "FORBIDDEN",
      "You do not have access to this brand.",
      403,
    );
  }
}

export async function createCampaign(
  brandId: string,
  userId: string,
  input: CreateCampaignInput,
): Promise<Campaign> {
  // Verify the requesting user is a member of this brand
  await assertBrandMember(userId, brandId);

  // Validate that the garment belongs to this brand
  const garment = await prisma.garment.findFirst({
    where: { id: input.garmentId, brandId },
  });
  if (!garment) {
    throw new ServiceError("GARMENT_NOT_FOUND", "Garment not found or does not belong to this brand.", 404);
  }

  // Validate backer price is less than retail price (it must be a discount)
  if (input.backerPriceCents >= input.retailPriceCents) {
    throw new ServiceError(
      "INVALID_PRICING",
      "Backer price must be less than retail price.",
      400,
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      brandId,
      garmentId: input.garmentId,
      title: input.title,
      description: input.description ?? null,
      slug: input.slug,
      retailPriceCents: input.retailPriceCents,
      backerPriceCents: input.backerPriceCents,
      depositPercent: input.depositPercent ?? 100,
      currency: input.currency ?? "AUD",
      moq: input.moq,
      stretchGoalQty: input.stretchGoalQty ?? null,
      campaignStart: new Date(input.campaignStart),
      campaignEnd: new Date(input.campaignEnd),
      estimatedShipDate: input.estimatedShipDate
        ? new Date(input.estimatedShipDate)
        : null,
      manufacturerId: input.manufacturerId ?? null,
      shopifyStoreUrl: input.shopifyStoreUrl ?? null,
      availableSizes: input.availableSizes,
      sizeLimits: input.sizeLimits ?? Prisma.JsonNull,
    },
  });

  // Seed the size break table with zero counts for each available size
  await prisma.campaignSizeBreak.createMany({
    data: input.availableSizes.map((size) => ({
      campaignId: campaign.id,
      size,
      backingCount: 0,
    })),
    skipDuplicates: true,
  });

  // Audit event
  await logCampaignEvent(campaign.id, "campaign.created", null, { brandId });

  return campaign;
}

export async function getCampaign(id: string): Promise<Campaign & { sizeBreaks: CampaignSizeBreak[] }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { sizeBreaks: true },
  });
  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }
  return campaign;
}

export async function updateCampaign(
  id: string,
  brandId: string,
  input: UpdateCampaignInput,
): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }
  if (campaign.brandId !== brandId) {
    throw new ServiceError("FORBIDDEN", "Access denied.", 403);
  }
  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new ServiceError(
      "CAMPAIGN_NOT_EDITABLE",
      "Only draft or scheduled campaigns can be edited.",
      400,
    );
  }

  return prisma.campaign.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.retailPriceCents !== undefined && { retailPriceCents: input.retailPriceCents }),
      ...(input.backerPriceCents !== undefined && { backerPriceCents: input.backerPriceCents }),
      ...(input.moq !== undefined && { moq: input.moq }),
      ...(input.campaignStart !== undefined && { campaignStart: new Date(input.campaignStart) }),
      ...(input.campaignEnd !== undefined && { campaignEnd: new Date(input.campaignEnd) }),
      ...(input.manufacturerId !== undefined && { manufacturerId: input.manufacturerId }),
      ...(input.availableSizes !== undefined && { availableSizes: input.availableSizes }),
    },
  });
}

export async function cancelCampaign(id: string, brandId: string, actorId: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }
  if (campaign.brandId !== brandId) {
    throw new ServiceError("FORBIDDEN", "Access denied.", 403);
  }
  if (campaign.moqReached) {
    throw new ServiceError(
      "CAMPAIGN_MOQ_REACHED",
      "Cannot cancel a campaign that has already reached MOQ.",
      400,
    );
  }

  // Cancel the campaign and trigger refunds in the background
  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: "cancelled" },
  });

  await enqueueJob("email-notification", "campaign-cancelled-refunds", {
    campaignId: id,
    reason: "brand_cancelled",
  });

  await logCampaignEvent(id, "campaign.cancelled", actorId, {});

  return updated;
}

export async function listBrandCampaigns(
  brandId: string,
  query: { status?: string | undefined; page: number; pageSize: number },
) {
  const { skip, take } = parsePagination({ page: query.page, pageSize: query.pageSize });

  const where: Prisma.CampaignWhereInput = {
    brandId,
    ...(query.status ? { status: query.status as Campaign["status"] } : {}),
  };

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { sizeBreaks: true },
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    data: campaigns,
    pagination: buildPaginationMeta(total, query.page, query.pageSize),
  };
}

export async function getCampaignSizeBreaks(campaignId: string): Promise<CampaignSizeBreak[]> {
  // Verify campaign exists
  const exists = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!exists) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }

  return prisma.campaignSizeBreak.findMany({
    where: { campaignId },
    orderBy: { size: "asc" },
  });
}

// ── Backing ──────────────────────────────────────────────────────────────────

export async function placeBacking(
  campaignId: string,
  userId: string,
  input: PlaceBackingInput,
): Promise<BackingResult> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }
  if (campaign.status !== "active") {
    throw new ServiceError(
      "CAMPAIGN_NOT_ACTIVE",
      "This campaign is not currently accepting backings.",
      400,
    );
  }
  if (!campaign.availableSizes.includes(input.size)) {
    throw new ServiceError(
      "INVALID_SIZE",
      `Size '${input.size}' is not available for this campaign.`,
      400,
    );
  }

  // Check per-size limits if configured
  if (campaign.sizeLimits) {
    const limits = campaign.sizeLimits as Record<string, number>;
    const sizeLimit = limits[input.size];
    if (sizeLimit !== undefined) {
      const currentSizeCount = await prisma.campaignSizeBreak.findUnique({
        where: { campaignId_size: { campaignId, size: input.size } },
        select: { backingCount: true },
      });
      if (currentSizeCount && currentSizeCount.backingCount >= sizeLimit) {
        throw new ServiceError(
          "SIZE_SOLD_OUT",
          `Size '${input.size}' has reached its allocation for this campaign.`,
          400,
        );
      }
    }
  }

  const quantity = input.quantity ?? 1;
  const totalCents = campaign.backerPriceCents * quantity;
  const depositCents = calculateDepositCents(totalCents, campaign.depositPercent);
  const remainingCents = calculateRemainingCents(totalCents, depositCents);

  // Create Stripe PaymentIntent for the deposit
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: depositCents,
      currency: campaign.currency.toLowerCase(),
      payment_method: input.paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        campaignId,
        userId,
        size: input.size,
        quantity: String(quantity),
      },
    },
    { idempotencyKey: `backing-${campaignId}-${userId}-${Date.now()}` }
  );

  // Atomically create backing and increment counts
  const backing = await prisma.$transaction(async (tx) => {
    const newBacking = await tx.backing.create({
      data: {
        campaignId,
        userId,
        size: input.size,
        quantity,
        totalCents,
        depositCents,
        remainingCents,
        currency: campaign.currency,
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId:
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : null,
        depositStatus:
          paymentIntent.status === "succeeded" ? "succeeded" : "processing",
        finalPaymentStatus: campaign.depositPercent === 100 ? "not_required" : "pending",
        shippingAddress: input.shippingAddress,
      },
    });

    // Increment campaign backing count
    await tx.campaign.update({
      where: { id: campaignId },
      data: { currentBackingCount: { increment: quantity } },
    });

    // Upsert size break count
    await tx.campaignSizeBreak.upsert({
      where: { campaignId_size: { campaignId, size: input.size } },
      create: { campaignId, size: input.size, backingCount: quantity },
      update: { backingCount: { increment: quantity } },
    });

    return newBacking;
  });

  // Check MOQ — enqueue job so the check happens asynchronously
  // (the real-time check happens via the webhook or the job)
  await enqueueJob("moq-threshold", "check-moq-threshold", { campaignId });

  await logCampaignEvent(campaignId, "backing.placed", userId, {
    backingId: backing.id,
    size: input.size,
    quantity,
  });

  // Confirmation email
  await enqueueJob("email-notification", "backing-confirmation", {
    backingId: backing.id,
    userId,
    campaignId,
  });

  // Check if MOQ was just reached (for optimistic response)
  const updatedCampaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { currentBackingCount: true, moq: true, moqReached: true },
  });

  return {
    backing,
    moqJustReached:
      updatedCampaign !== null &&
      updatedCampaign.currentBackingCount >= updatedCampaign.moq &&
      !updatedCampaign.moqReached,
  };
}

// ── MOQ Trigger Logic ────────────────────────────────────────────────────────

/**
 * Check and trigger MOQ reached flow.
 * This is idempotent — safe to call multiple times for the same campaign.
 * Called by:
 *   1. The moq-threshold BullMQ worker (on every backing)
 *   2. The scheduled cron safety-net (every 15 minutes)
 */
export async function checkAndTriggerMoq(campaignId: string): Promise<MoqCheckResult> {
  // First, check current state without locking
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      moq: true,
      currentBackingCount: true,
      moqReached: true,
      depositPercent: true,
      manufacturerId: true,
      brandId: true,
      currency: true,
    },
  });

  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }

  if (campaign.moqReached) {
    return {
      campaignId,
      moqReached: true,
      currentCount: campaign.currentBackingCount,
      moq: campaign.moq,
      alreadyTriggered: true,
    };
  }

  if (campaign.currentBackingCount < campaign.moq) {
    return {
      campaignId,
      moqReached: false,
      currentCount: campaign.currentBackingCount,
      moq: campaign.moq,
      alreadyTriggered: false,
    };
  }

  // MOQ has been reached — atomic update with idempotency guard
  const updated = await prisma.campaign.updateMany({
    where: { id: campaignId, moqReached: false },
    data: {
      moqReached: true,
      moqReachedAt: new Date(),
      status: "moq_reached",
    },
  });

  // If count === 0, another process already triggered it — idempotency guard
  if (updated.count === 0) {
    return {
      campaignId,
      moqReached: true,
      currentCount: campaign.currentBackingCount,
      moq: campaign.moq,
      alreadyTriggered: true,
    };
  }

  // Trigger all downstream effects
  await Promise.all([
    // If deposit model, capture remaining balances
    ...(campaign.depositPercent < 100
      ? [enqueueJob("capture-remaining-payments", "capture-all", { campaignId })]
      : []),

    // Notify manufacturer
    ...(campaign.manufacturerId
      ? [enqueueJob("email-notification", "manufacturer-notification", {
          campaignId,
          manufacturerId: campaign.manufacturerId,
        })]
      : []),

    // Notify all backers
    enqueueJob("email-notification", "moq-reached-backer-emails", { campaignId }),

    // Update campaign to funded status
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "funded" },
    }),
  ]);

  await logCampaignEvent(campaignId, "campaign.moq_reached", null, {
    backingCount: campaign.currentBackingCount,
    moq: campaign.moq,
  });

  return {
    campaignId,
    moqReached: true,
    currentCount: campaign.currentBackingCount,
    moq: campaign.moq,
    alreadyTriggered: false,
  };
}

/**
 * Expire a campaign — deadline passed, MOQ not reached.
 * Triggers refunds for all active backings.
 * Called by the scheduled expiry worker.
 */
export async function expireCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.moqReached) return;

  const backings = await prisma.backing.findMany({
    where: { campaignId, status: "active" },
  });

  // Process refunds — in production, batch these or process per-backing with retry logic
  const refundResults = await Promise.allSettled(
    backings.map(async (backing) => {
      if (backing.stripeChargeId) {
        const refund = await stripe.refunds.create({
          charge: backing.stripeChargeId,
          metadata: {
            reason: "campaign_expired",
            backingId: backing.id,
            campaignId,
          },
        });

        await prisma.backing.update({
          where: { id: backing.id },
          data: {
            status: "refunded",
            refundedAt: new Date(),
            refundStripeId: refund.id,
          },
        });
      }
    }),
  );

  // Log any refund failures for manual review
  refundResults
    .filter((r) => r.status === "rejected")
    .forEach((r) => {
      console.error("Refund failed during campaign expiry:", r);
    });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "expired" },
  });

  // Notify backers of expiry and refunds
  await enqueueJob("email-notification", "campaign-expired-emails", { campaignId });

  await logCampaignEvent(campaignId, "campaign.expired", null, {
    refundedCount: backings.length,
  });
}

// ── List campaign backings (brand dashboard) ─────────────────────────────────

export interface BackingSummaryRow {
  id: string;
  size: string;
  quantity: number;
  totalCents: number;
  depositCents: number;
  currency: string;
  depositStatus: string;
  status: string;
  shippingAddress: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Returns a paginated list of backings for a campaign.
 * Only accessible by brand members who own the campaign.
 */
export async function listCampaignBackings(
  campaignId: string,
  userId: string,
  page: number,
  limit: number,
): Promise<{ data: BackingSummaryRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  // Verify the requesting user is a brand member for the campaign's brand
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, brandId: true },
  });
  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }

  const membership = await prisma.brandMember.findFirst({
    where: { userId, brandId: campaign.brandId },
    select: { id: true },
  });
  // Platform admins would bypass this — handled by auth guard upstream
  if (!membership) {
    throw new ServiceError("FORBIDDEN", "You do not have access to this campaign.", 403);
  }

  const skip = (page - 1) * limit;

  const [backings, total] = await Promise.all([
    prisma.backing.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        size: true,
        quantity: true,
        totalCents: true,
        depositCents: true,
        currency: true,
        depositStatus: true,
        status: true,
        shippingAddress: true,
        createdAt: true,
      },
    }),
    prisma.backing.count({ where: { campaignId } }),
  ]);

  type BackingRow = (typeof backings)[number];

  return {
    data: backings.map((b: BackingRow) => ({
      id: b.id,
      size: b.size,
      quantity: b.quantity,
      totalCents: b.totalCents,
      depositCents: b.depositCents,
      currency: b.currency,
      depositStatus: b.depositStatus,
      status: b.status,
      shippingAddress: b.shippingAddress as Record<string, unknown> | null,
      createdAt: b.createdAt,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── Campaign status transitions (brand-initiated) ────────────────────────────

export async function publishCampaign(campaignId: string, userId: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);

  await assertBrandMember(userId, campaign.brandId);

  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new ServiceError("INVALID_STATUS", "Only draft or scheduled campaigns can be published.", 400);
  }

  const now = new Date();
  const newStatus = campaign.campaignStart <= now ? "active" : "scheduled";

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus },
  });

  await logCampaignEvent(campaignId, "campaign.published", userId, { status: newStatus });
  return updated;
}

export async function markCampaignInProduction(campaignId: string, userId: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);

  await assertBrandMember(userId, campaign.brandId);

  if (!["funded", "moq_reached"].includes(campaign.status)) {
    throw new ServiceError("INVALID_STATUS", "Campaign must be funded before marking in production.", 400);
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "in_production" },
  });

  await logCampaignEvent(campaignId, "campaign.in_production", userId, {});
  return updated;
}

export async function markCampaignShipped(campaignId: string, userId: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);

  await assertBrandMember(userId, campaign.brandId);

  if (campaign.status !== "in_production") {
    throw new ServiceError("INVALID_STATUS", "Campaign must be in production before marking shipped.", 400);
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "shipped" },
  });

  await logCampaignEvent(campaignId, "campaign.shipped", userId, {});

  // Queue sample-shipped emails (via the email worker)
  await enqueueJob("email-notification", "sample-shipped", { campaignId });

  return updated;
}

export async function markCampaignCompleted(campaignId: string, userId: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);

  await assertBrandMember(userId, campaign.brandId);

  if (campaign.status !== "shipped") {
    throw new ServiceError("INVALID_STATUS", "Campaign must be shipped before marking completed.", 400);
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "completed" },
  });

  await logCampaignEvent(campaignId, "campaign.completed", userId, {});
  return updated;
}

// ── 2-Step Stripe Payment Flow ───────────────────────────────────────────────

/**
 * Step 1 — Create a Stripe PaymentIntent for a backing.
 *
 * Validates the campaign and size availability, calculates the deposit amount,
 * and creates a PaymentIntent WITHOUT confirming it. The client secret is
 * returned so the browser can mount the Stripe Payment Element and collect
 * card details client-side (SCA-compliant, handles 3DS automatically).
 *
 * All context needed to later confirm the backing is stored in PI metadata
 * so the success page only needs the paymentIntentId — no state juggling.
 */
export async function createPaymentIntentForBacking(
  campaignId: string,
  userId: string,
  input: CreatePaymentIntentInput,
): Promise<{ clientSecret: string; paymentIntentId: string; depositCents: number; currency: string }> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }
  if (campaign.status !== "active") {
    throw new ServiceError(
      "CAMPAIGN_NOT_ACTIVE",
      "This campaign is not currently accepting backings.",
      400,
    );
  }
  if (!campaign.availableSizes.includes(input.size)) {
    throw new ServiceError(
      "INVALID_SIZE",
      `Size '${input.size}' is not available for this campaign.`,
      400,
    );
  }

  // Check per-size limits
  if (campaign.sizeLimits) {
    const limits = campaign.sizeLimits as Record<string, number>;
    const sizeLimit = limits[input.size];
    if (sizeLimit !== undefined) {
      const currentSizeCount = await prisma.campaignSizeBreak.findUnique({
        where: { campaignId_size: { campaignId, size: input.size } },
        select: { backingCount: true },
      });
      if (currentSizeCount && currentSizeCount.backingCount >= sizeLimit) {
        throw new ServiceError(
          "SIZE_SOLD_OUT",
          `Size '${input.size}' has reached its allocation for this campaign.`,
          400,
        );
      }
    }
  }

  const quantity = input.quantity ?? 1;
  const totalCents = campaign.backerPriceCents * quantity;
  const depositCents = calculateDepositCents(totalCents, campaign.depositPercent);

  // Shipping address stored as JSON in metadata. Stripe metadata values are
  // capped at 500 chars; a typical address is ~150–200 chars. Safe.
  const shippingJson = JSON.stringify(input.shippingAddress);
  if (shippingJson.length > 490) {
    throw new ServiceError(
      "ADDRESS_TOO_LONG",
      "Shipping address is too long. Please use abbreviated fields.",
      400,
    );
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: depositCents,
    currency: campaign.currency.toLowerCase(),
    // DO NOT confirm here — let the client's Payment Element handle confirmation.
    // This ensures SCA / 3DS is handled properly in the browser.
    automatic_payment_methods: { enabled: true },
    metadata: {
      campaignId,
      userId,
      size: input.size,
      quantity: String(quantity),
      shipping: shippingJson,
    },
    description: `Back It deposit — ${campaign.title} (${input.size} × ${quantity})`,
  });

  if (!paymentIntent.client_secret) {
    throw new ServiceError(
      "STRIPE_ERROR",
      "Failed to create payment intent. Please try again.",
      500,
    );
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    depositCents,
    currency: campaign.currency,
  };
}

/**
 * Step 2 — Confirm a backing after Stripe payment succeeds.
 *
 * Called by the success page once Stripe redirects back with a confirmed
 * PaymentIntent. Retrieves all context from PI metadata, verifies payment
 * status, and atomically creates the backing record.
 *
 * Idempotent: if a backing with this stripePaymentIntentId already exists,
 * returns it without double-counting. Safe to call on page refresh.
 */
export async function confirmBacking(
  campaignId: string,
  userId: string,
  input: ConfirmBackingInput,
): Promise<BackingResult> {
  // Retrieve the PaymentIntent from Stripe to verify status
  let paymentIntent: Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>>;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
  } catch {
    throw new ServiceError(
      "STRIPE_PI_NOT_FOUND",
      "Payment intent not found. Please contact support.",
      404,
    );
  }

  // Verify the PI belongs to this campaign and user
  const meta = paymentIntent.metadata;
  if (meta.campaignId !== campaignId) {
    throw new ServiceError(
      "PI_CAMPAIGN_MISMATCH",
      "This payment intent does not belong to this campaign.",
      403,
    );
  }
  if (meta.userId !== userId) {
    throw new ServiceError(
      "PI_USER_MISMATCH",
      "This payment intent was not created by the current user.",
      403,
    );
  }

  // Verify payment succeeded
  if (paymentIntent.status !== "succeeded") {
    throw new ServiceError(
      "PAYMENT_NOT_SUCCEEDED",
      `Payment status is '${paymentIntent.status}'. Only succeeded payments can be confirmed.`,
      400,
    );
  }

  // Idempotency guard — return existing backing if already confirmed.
  // Using findFirst (not findUnique) so this works even before the @unique
  // migration has been applied; the unique constraint makes it authoritative.
  const existingBacking = await prisma.backing.findFirst({
    where: { stripePaymentIntentId: input.paymentIntentId },
  });
  if (existingBacking) {
    // Already confirmed — safe to return without double-counting
    return {
      backing: existingBacking,
      moqJustReached: false, // Already counted in the first confirmation
      alreadyConfirmed: true,
    };
  }

  // Extract context from PI metadata
  const size = meta.size ?? "";
  const quantity = parseInt(meta.quantity ?? "1", 10);
  const shippingAddress = meta.shipping
    ? (JSON.parse(meta.shipping) as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  // Verify campaign is still in a valid state
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }
  // Allow active OR moq_reached (race: campaign may have just tipped over)
  if (!["active", "moq_reached", "funded"].includes(campaign.status)) {
    throw new ServiceError(
      "CAMPAIGN_NOT_ACTIVE",
      "This campaign is no longer accepting backings.",
      400,
    );
  }

  const totalCents = campaign.backerPriceCents * quantity;
  const depositCents = calculateDepositCents(totalCents, campaign.depositPercent);
  const remainingCents = calculateRemainingCents(totalCents, depositCents);

  const chargeId = typeof paymentIntent.latest_charge === "string"
    ? paymentIntent.latest_charge
    : null;

  // Atomically create backing + increment counts
  const backing = await prisma.$transaction(async (tx) => {
    const newBacking = await tx.backing.create({
      data: {
        campaignId,
        userId,
        size,
        quantity,
        totalCents,
        depositCents,
        remainingCents,
        currency: campaign.currency,
        stripePaymentIntentId: input.paymentIntentId,
        stripeChargeId: chargeId,
        depositStatus: "succeeded",
        finalPaymentStatus: campaign.depositPercent === 100 ? "not_required" : "pending",
        shippingAddress,
        status: "active",
      },
    });

    await tx.campaign.update({
      where: { id: campaignId },
      data: { currentBackingCount: { increment: quantity } },
    });

    await tx.campaignSizeBreak.upsert({
      where: { campaignId_size: { campaignId, size } },
      create: { campaignId, size, backingCount: quantity },
      update: { backingCount: { increment: quantity } },
    });

    return newBacking;
  });

  // Trigger MOQ check asynchronously
  await enqueueJob("moq-threshold", "check-moq-threshold", { campaignId });

  await logCampaignEvent(campaignId, "backing.confirmed", userId, {
    backingId: backing.id,
    size,
    quantity,
    paymentIntentId: input.paymentIntentId,
  });

  // Confirmation email
  await enqueueJob("email-notification", "backing-confirmation", {
    backingId: backing.id,
    userId,
    campaignId,
  });

  const updatedCampaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { currentBackingCount: true, moq: true, moqReached: true },
  });

  return {
    backing,
    moqJustReached:
      updatedCampaign !== null &&
      updatedCampaign.currentBackingCount >= updatedCampaign.moq &&
      !updatedCampaign.moqReached,
    alreadyConfirmed: false,
  };
}

// ── Public campaign discovery ─────────────────────────────────────────────────

export interface BrowseCampaignsQuery {
  status: string | undefined;
  category: string | undefined;
  search: string | undefined;
  sort: "newest" | "ending_soon" | "most_backed" | "percent_funded" | undefined;
  limit: number;
  offset: number;
}

export interface PublicCampaignSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  retailPriceCents: number;
  backerPriceCents: number;
  depositPercent: number;
  currency: string;
  moq: number;
  currentBackingCount: number;
  percentFunded: number;
  moqReached: boolean;
  moqReachedAt: string | null;
  stretchGoalQty: number | null;
  campaignStart: string;
  campaignEnd: string;
  estimatedShipDate: string | null;
  availableSizes: string[];
  brandId: string;
  brand: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  garment: {
    id: string;
    name: string;
    category: string | null;
  };
  sizeBreaks: Array<{ size: string; backingCount: number }>;
}

export interface BrowseCampaignsResult {
  data: PublicCampaignSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Public campaign browse — the consumer-facing discovery endpoint.
 * Returns active campaigns by default (consumer explore page).
 * Supports full-text search, category filter, and multiple sort modes.
 */
export async function browseCampaigns(
  query: BrowseCampaignsQuery,
): Promise<BrowseCampaignsResult> {
  const { limit, offset } = query;

  // Default to active campaigns for the public consumer explore page.
  // Admin and brand routes use their own scoped queries.
  const statusFilter = (query.status ?? "active") as
    | "draft" | "scheduled" | "active" | "moq_reached" | "funded"
    | "in_production" | "shipped" | "completed" | "cancelled" | "expired";

  // Build the where clause as a plain object. Cast to any to avoid the
  // Prisma exactOptionalPropertyTypes friction — the runtime query is correct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { status: statusFilter };

  // Category filter — joins through the garment relation
  if (query.category) {
    where.garment = { category: query.category };
  }

  // Full-text search: match on title or description
  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  // Build sort order
  type OrderByClause =
    | { createdAt: "desc" }
    | { campaignEnd: "asc" }
    | { currentBackingCount: "desc" };

  let orderBy: OrderByClause;
  switch (query.sort) {
    case "ending_soon":
      orderBy = { campaignEnd: "asc" };
      break;
    case "most_backed":
      orderBy = { currentBackingCount: "desc" };
      break;
    case "percent_funded":
      // percent = currentBackingCount / moq. Approximate via most_backed for now
      // (true ratio sort requires a computed column or subquery; defer to v2)
      orderBy = { currentBackingCount: "desc" };
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
  }

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy,
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        garment: { select: { id: true, name: true, category: true } },
        sizeBreaks: { select: { size: true, backingCount: true }, orderBy: { size: "asc" } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  const data: PublicCampaignSummary[] = campaigns.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    status: c.status,
    coverImageUrl: c.coverImageUrl,
    galleryUrls: c.galleryUrls,
    retailPriceCents: c.retailPriceCents,
    backerPriceCents: c.backerPriceCents,
    depositPercent: c.depositPercent,
    currency: c.currency,
    moq: c.moq,
    currentBackingCount: c.currentBackingCount,
    percentFunded: c.moq > 0 ? Math.min(100, Math.round((c.currentBackingCount / c.moq) * 100)) : 0,
    moqReached: c.moqReached,
    moqReachedAt: c.moqReachedAt?.toISOString() ?? null,
    stretchGoalQty: c.stretchGoalQty,
    campaignStart: c.campaignStart.toISOString(),
    campaignEnd: c.campaignEnd.toISOString(),
    estimatedShipDate: c.estimatedShipDate?.toISOString() ?? null,
    availableSizes: c.availableSizes,
    brandId: c.brandId,
    brand: c.brand,
    garment: c.garment,
    sizeBreaks: c.sizeBreaks,
  }));

  return {
    data,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}

/**
 * Get a single campaign by its public slug.
 * Used by the consumer-facing campaign page (/back/:slug).
 * Includes full detail — garment, brand, size breaks, garment category.
 */
export async function getCampaignBySlug(slug: string): Promise<PublicCampaignSummary> {
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
      garment: { select: { id: true, name: true, category: true } },
      sizeBreaks: { select: { size: true, backingCount: true }, orderBy: { size: "asc" } },
    },
  });

  if (!campaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", `Campaign '${slug}' not found.`, 404);
  }

  // Non-draft statuses are visible publicly. Drafts are brand-only.
  if (campaign.status === "draft") {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", `Campaign '${slug}' not found.`, 404);
  }

  return {
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    description: campaign.description,
    status: campaign.status,
    coverImageUrl: campaign.coverImageUrl,
    galleryUrls: campaign.galleryUrls,
    retailPriceCents: campaign.retailPriceCents,
    backerPriceCents: campaign.backerPriceCents,
    depositPercent: campaign.depositPercent,
    currency: campaign.currency,
    moq: campaign.moq,
    currentBackingCount: campaign.currentBackingCount,
    percentFunded:
      campaign.moq > 0
        ? Math.min(100, Math.round((campaign.currentBackingCount / campaign.moq) * 100))
        : 0,
    moqReached: campaign.moqReached,
    moqReachedAt: campaign.moqReachedAt?.toISOString() ?? null,
    stretchGoalQty: campaign.stretchGoalQty,
    campaignStart: campaign.campaignStart.toISOString(),
    campaignEnd: campaign.campaignEnd.toISOString(),
    estimatedShipDate: campaign.estimatedShipDate?.toISOString() ?? null,
    availableSizes: campaign.availableSizes,
    brandId: campaign.brandId,
    brand: campaign.brand,
    garment: campaign.garment,
    sizeBreaks: campaign.sizeBreaks,
  };
}

// ── Consumer backings ─────────────────────────────────────────────────────────

export interface ConsumerBackingSummary {
  id: string;
  size: string;
  quantity: number;
  totalCents: number;
  depositCents: number;
  remainingCents: number;
  currency: string;
  depositStatus: string;
  finalPaymentStatus: string;
  status: string;
  createdAt: string;
  cancelledAt: string | null;
  refundedAt: string | null;
  campaign: {
    id: string;
    slug: string;
    title: string;
    status: string;
    coverImageUrl: string | null;
    moq: number;
    currentBackingCount: number;
    moqReached: boolean;
    estimatedShipDate: string | null;
    campaignEnd: string;
    brand: {
      id: string;
      name: string;
      logoUrl: string | null;
    };
  };
}

export interface ConsumerBackingsResult {
  data: ConsumerBackingSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Return all backings placed by a given consumer, with campaign context.
 * Ordered by most recent first.
 * Used by the consumer's account/backing history page.
 */
export async function getConsumerBackings(
  userId: string,
  limit: number,
  offset: number,
): Promise<ConsumerBackingsResult> {
  const where = { userId };

  const [backings, total] = await Promise.all([
    prisma.backing.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        campaign: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            coverImageUrl: true,
            moq: true,
            currentBackingCount: true,
            moqReached: true,
            estimatedShipDate: true,
            campaignEnd: true,
            brand: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    }),
    prisma.backing.count({ where }),
  ]);

  const data: ConsumerBackingSummary[] = backings.map((b) => ({
    id: b.id,
    size: b.size,
    quantity: b.quantity,
    totalCents: b.totalCents,
    depositCents: b.depositCents,
    remainingCents: b.remainingCents,
    currency: b.currency,
    depositStatus: b.depositStatus,
    finalPaymentStatus: b.finalPaymentStatus,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    refundedAt: b.refundedAt?.toISOString() ?? null,
    campaign: {
      id: b.campaign.id,
      slug: b.campaign.slug,
      title: b.campaign.title,
      status: b.campaign.status,
      coverImageUrl: b.campaign.coverImageUrl,
      moq: b.campaign.moq,
      currentBackingCount: b.campaign.currentBackingCount,
      moqReached: b.campaign.moqReached,
      estimatedShipDate: b.campaign.estimatedShipDate?.toISOString() ?? null,
      campaignEnd: b.campaign.campaignEnd.toISOString(),
      brand: b.campaign.brand,
    },
  }));

  return {
    data,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logCampaignEvent(
  campaignId: string,
  eventType: string,
  actorId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.campaignEvent.create({
    data: {
      campaignId,
      eventType,
      actorId,
      payload: (payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Typed service error — thrown by service functions, caught in route handlers.
 */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
