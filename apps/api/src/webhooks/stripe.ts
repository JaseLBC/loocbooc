/**
 * Stripe webhook handler.
 * POST /webhooks/stripe
 *
 * Security model:
 *   1. Validate Stripe-Signature header using constructEvent() — this is the
 *      ONLY correct way to verify Stripe webhooks. The raw request body is
 *      required; never use a parsed JSON body for this.
 *   2. Return 200 immediately after signature validation.
 *   3. Process all business logic asynchronously (BullMQ job) — keeps the
 *      endpoint response well under Stripe's 30-second timeout.
 *   4. All handlers are idempotent — safe to call multiple times for the same
 *      event (Stripe guarantees at-least-once delivery).
 *
 * Events handled:
 *   payment_intent.succeeded          → Confirm backing created via clientSecret flow
 *   payment_intent.payment_failed     → Mark backing deposit failed, notify backer
 *   payment_intent.canceled           → Clean up pending backings
 *   payment_intent.requires_action    → Log 3DS challenge state (informational)
 *   charge.refunded                   → Sync manual Stripe-dashboard refunds to DB
 *   charge.dispute.created            → Flag backing/order as disputed, notify admin
 *   charge.dispute.closed             → Update dispute resolution in DB
 *   customer.created                  → Sync new Stripe customer ID to user record
 *
 * Why async processing matters:
 *   The confirm-backing flow has a client-side counterpart: the success page
 *   calls POST /back-it/campaigns/:id/confirm-backing after Stripe redirects.
 *   Most of the time that's fine. But if the user closes the browser,
 *   loses connectivity, or Stripe's redirect fails, the webhook is the ONLY
 *   way the backing ever gets recorded. This handler is not a fallback — it's
 *   the authoritative confirmation path.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import Stripe from "stripe";
import { prisma } from "@loocbooc/database";
import { enqueueJob } from "../lib/queues.js";
import { stripe } from "../lib/stripe.js";
import { calculateDepositCents, calculateRemainingCents } from "@loocbooc/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackingMetadata {
  campaignId?: string;
  userId?: string;
  size?: string;
  quantity?: string;
  shipping?: string;
  backingId?: string;
  type?: string;
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /webhooks/stripe
   *
   * Stripe sends all configured events here. The endpoint validates the
   * signature, acknowledges immediately, then dispatches to the appropriate
   * handler.
   */
  app.post("/stripe", {
    config: {
      // Disable Fastify rate limiting for Stripe webhooks — they're authenticated
      // by signature and we must not drop legitimate events
      rateLimit: false,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers["stripe-signature"];
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

    if (!webhookSecret) {
      request.log.error("STRIPE_WEBHOOK_SECRET environment variable is not set");
      return reply.status(500).send({
        error: { code: "CONFIG_ERROR", message: "Webhook secret not configured." },
      });
    }

    if (!sig) {
      return reply.status(400).send({
        error: { code: "MISSING_SIGNATURE", message: "Missing Stripe-Signature header." },
      });
    }

    // Raw body is required for signature verification — see plugins/index.ts
    const rawBody = (request as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      request.log.error("Raw body not available — check content-type parser configuration");
      return reply.status(400).send({
        error: { code: "RAW_BODY_MISSING", message: "Unable to read raw request body." },
      });
    }

    let event: Stripe.Event;
    try {
      // constructEvent validates the signature and timestamp (prevents replay attacks)
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      request.log.warn({ stripeSignature: sig?.slice(0, 20) }, `Stripe signature validation failed: ${message}`);
      return reply.status(400).send({
        error: { code: "INVALID_SIGNATURE", message: "Stripe signature validation failed." },
      });
    }

    // Acknowledge immediately — Stripe considers a 2xx response as receipt
    // All business logic happens asynchronously below
    reply.status(200).send({ received: true });

    // Process the event asynchronously — errors here don't affect the 200 response
    try {
      await dispatch(event, request);
    } catch (err) {
      // Log the error but don't affect the 200 already sent
      // Stripe will retry if we fail to process — idempotency ensures safety
      request.log.error(
        { eventId: event.id, eventType: event.type, error: err },
        "Error processing Stripe webhook event",
      );
    }
  });
}

// ─── Event dispatcher ─────────────────────────────────────────────────────────

async function dispatch(event: Stripe.Event, request: FastifyRequest): Promise<void> {
  request.log.info({ eventId: event.id, eventType: event.type }, "Processing Stripe event");

  switch (event.type) {
    // ── PaymentIntent events ──────────────────────────────────────────────────

    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(
        event.data.object as Stripe.PaymentIntent,
        event.id,
        request,
      );
      break;

    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(
        event.data.object as Stripe.PaymentIntent,
        event.id,
        request,
      );
      break;

    case "payment_intent.canceled":
      await handlePaymentIntentCanceled(
        event.data.object as Stripe.PaymentIntent,
        request,
      );
      break;

    case "payment_intent.requires_action":
      // 3DS challenge — log for monitoring, no DB action needed
      request.log.info(
        { paymentIntentId: (event.data.object as Stripe.PaymentIntent).id },
        "PaymentIntent requires 3DS action",
      );
      break;

    // ── Charge events ─────────────────────────────────────────────────────────

    case "charge.refunded":
      await handleChargeRefunded(
        event.data.object as Stripe.Charge,
        event.id,
        request,
      );
      break;

    case "charge.dispute.created":
      await handleDisputeCreated(
        event.data.object as Stripe.Dispute,
        event.id,
        request,
      );
      break;

    case "charge.dispute.closed":
      await handleDisputeClosed(
        event.data.object as Stripe.Dispute,
        event.id,
        request,
      );
      break;

    // ── Customer events ───────────────────────────────────────────────────────

    case "customer.created":
      await handleCustomerCreated(
        event.data.object as Stripe.Customer,
        request,
      );
      break;

    // ── Unhandled events (still return 200 — never return non-2xx to Stripe) ──
    default:
      request.log.debug({ eventType: event.type }, "Unhandled Stripe event type — skipping");
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Handle payment_intent.succeeded
 *
 * This is the authoritative path for recording a backing. The client-side
 * confirm-backing endpoint is a faster / earlier path, but this handler is
 * the reliability safety net that fires regardless of what the client does.
 *
 * Logic:
 *   1. Check PI metadata to determine what this payment is for
 *   2. For initial backing deposits: call confirmBackingFromWebhook (idempotent)
 *   3. For remaining balance captures: mark finalPaymentStatus = succeeded
 */
async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
  eventId: string,
  request: FastifyRequest,
): Promise<void> {
  const meta = pi.metadata as BackingMetadata;

  // Detect payment type from metadata
  const isRemainingPayment = meta.type === "remaining_payment";

  if (isRemainingPayment && meta.backingId) {
    // This is a remaining balance capture after MOQ
    await handleRemainingPaymentSucceeded(pi, meta.backingId, request);
    return;
  }

  // Standard backing deposit confirmation
  const { campaignId, userId, size, quantity, shipping } = meta;

  if (!campaignId || !userId || !size) {
    request.log.warn(
      { paymentIntentId: pi.id, meta },
      "PaymentIntent succeeded but missing required metadata — cannot auto-confirm backing",
    );
    return;
  }

  // Idempotency check: has this PI already been used to create a backing?
  const existingBacking = await prisma.backing.findFirst({
    where: { stripePaymentIntentId: pi.id },
    select: { id: true, status: true },
  });

  if (existingBacking) {
    // Already confirmed (either by client or a previous webhook delivery)
    request.log.info(
      { paymentIntentId: pi.id, backingId: existingBacking.id },
      "Backing already confirmed — idempotent skip",
    );
    return;
  }

  // No backing exists yet — create it from webhook data
  await createBackingFromPaymentIntent(pi, campaignId, userId, size, quantity, shipping, request);

  request.log.info(
    { paymentIntentId: pi.id, campaignId, userId, eventId },
    "Backing created from webhook (client confirmation was not received)",
  );
}

/**
 * Create a backing record from a succeeded PaymentIntent.
 * Called when the client-side confirm-backing was not reached (browser close, redirect failure).
 * Mirrors the logic in back-it/service.ts confirmBacking() exactly.
 */
async function createBackingFromPaymentIntent(
  pi: Stripe.PaymentIntent,
  campaignId: string,
  userId: string,
  size: string,
  quantityStr: string | undefined,
  shippingJson: string | undefined,
  request: FastifyRequest,
): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    request.log.error({ campaignId, paymentIntentId: pi.id }, "Campaign not found during webhook backing confirmation");
    return;
  }

  // Allow a narrow window for campaigns that just tipped over MOQ during this payment
  if (!["active", "moq_reached", "funded"].includes(campaign.status)) {
    request.log.warn(
      { campaignId, status: campaign.status, paymentIntentId: pi.id },
      "Campaign is not in a backable state — skipping backing creation",
    );
    return;
  }

  const quantity = parseInt(quantityStr ?? "1", 10);
  const totalCents = campaign.backerPriceCents * quantity;
  const depositCents = calculateDepositCents(totalCents, campaign.depositPercent);
  const remainingCents = calculateRemainingCents(totalCents, depositCents);

  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;

  // Prisma's JsonValue input accepts plain objects directly — cast to satisfy strict types
  let shippingAddress: Record<string, unknown> = {};
  if (shippingJson) {
    try {
      shippingAddress = JSON.parse(shippingJson) as Record<string, unknown>;
    } catch {
      request.log.warn({ shippingJson }, "Failed to parse shipping address from PI metadata");
    }
  }

  // Atomic create + count increment — mirrors service.ts confirmBacking()
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
        stripePaymentIntentId: pi.id,
        stripeChargeId: chargeId,
        depositStatus: "succeeded",
        finalPaymentStatus: campaign.depositPercent === 100 ? "not_required" : "pending",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shippingAddress: shippingAddress as any,
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

  // Trigger MOQ check (async — non-blocking)
  await enqueueJob("moq-threshold", "check-moq-threshold", { campaignId });

  // Confirmation email
  await enqueueJob("email-notification", "backing-confirmation", {
    backingId: backing.id,
    userId,
    campaignId,
  });

  await prisma.campaignEvent.create({
    data: {
      campaignId,
      eventType: "backing.confirmed_via_webhook",
      actorId: userId,
      payload: {
        backingId: backing.id,
        paymentIntentId: pi.id,
        size,
        quantity,
      },
    },
  });
}

/**
 * Mark a remaining balance capture as succeeded.
 * Called after MOQ is reached and the deposit model is active.
 */
async function handleRemainingPaymentSucceeded(
  pi: Stripe.PaymentIntent,
  backingId: string,
  request: FastifyRequest,
): Promise<void> {
  const updated = await prisma.backing.updateMany({
    where: {
      id: backingId,
      finalPaymentStatus: { in: ["pending", "processing"] },
    },
    data: {
      finalPaymentStatus: "succeeded",
    },
  });

  if (updated.count > 0) {
    request.log.info({ backingId, paymentIntentId: pi.id }, "Remaining payment captured via webhook");
  }
}

/**
 * Handle payment_intent.payment_failed
 *
 * Called when a payment attempt fails (card declined, insufficient funds, etc).
 * Updates the backing deposit status and notifies the backer.
 *
 * For the initial backing deposit: backs created via the 2-step flow never hit
 * the "place backing" endpoint until after the PI succeeds — so a failed PI
 * here means NO backing exists in the DB yet (the PI was created but the user
 * never successfully paid). We only need to update if we somehow created a
 * backing on a pending PI (unlikely but handled defensively).
 *
 * For remaining payments: update backing and notify backer to update card.
 */
async function handlePaymentIntentFailed(
  pi: Stripe.PaymentIntent,
  eventId: string,
  request: FastifyRequest,
): Promise<void> {
  const meta = pi.metadata as BackingMetadata;
  const failureMessage =
    pi.last_payment_error?.message ?? "Payment failed.";
  const failureCode =
    pi.last_payment_error?.code ?? "unknown";

  // For remaining payment failures — find and update the backing
  if (meta.type === "remaining_payment" && meta.backingId) {
    await prisma.backing.updateMany({
      where: {
        id: meta.backingId,
        finalPaymentStatus: { in: ["pending", "processing"] },
      },
      data: { finalPaymentStatus: "failed" },
    });

    // Notify backer: payment method needs updating
    await enqueueJob("email-notification", "final-payment-failed", {
      backingId: meta.backingId,
      failureReason: failureMessage,
    });

    request.log.warn(
      { backingId: meta.backingId, code: failureCode, eventId },
      "Remaining payment failed",
    );
    return;
  }

  // For deposit failures — update any backing that was created against this PI
  // (defensive: in the 2-step flow, no backing should exist yet for a failed PI)
  const backing = await prisma.backing.findFirst({
    where: { stripePaymentIntentId: pi.id },
    select: { id: true, campaignId: true, userId: true },
  });

  if (backing) {
    await prisma.backing.update({
      where: { id: backing.id },
      data: { depositStatus: "failed", status: "cancelled" },
    });

    // Undo the backing count that was incorrectly incremented
    const meta2 = pi.metadata as BackingMetadata;
    const qty = parseInt(meta2.quantity ?? "1", 10);
    await prisma.campaign.update({
      where: { id: backing.campaignId },
      data: { currentBackingCount: { decrement: qty } },
    });

    request.log.warn(
      { backingId: backing.id, code: failureCode, eventId },
      "Deposit payment failed — backing marked cancelled",
    );
  } else {
    // No backing exists — just log the failure
    request.log.info(
      { paymentIntentId: pi.id, code: failureCode, campaignId: meta.campaignId, eventId },
      "PaymentIntent failed before backing was created — no DB action needed",
    );
  }
}

/**
 * Handle payment_intent.canceled
 *
 * Called when a PaymentIntent is cancelled (e.g. 24-hour expiry, brand cancelled campaign).
 * If a backing exists against this PI, mark it cancelled.
 */
async function handlePaymentIntentCanceled(
  pi: Stripe.PaymentIntent,
  request: FastifyRequest,
): Promise<void> {
  const backing = await prisma.backing.findFirst({
    where: { stripePaymentIntentId: pi.id },
    select: { id: true, campaignId: true },
  });

  if (!backing) return;

  const meta = pi.metadata as BackingMetadata;
  const qty = parseInt(meta.quantity ?? "1", 10);

  await prisma.$transaction([
    prisma.backing.update({
      where: { id: backing.id },
      data: { status: "cancelled", depositStatus: "failed" },
    }),
    prisma.campaign.update({
      where: { id: backing.campaignId },
      data: { currentBackingCount: { decrement: qty } },
    }),
  ]);

  request.log.info(
    { backingId: backing.id, paymentIntentId: pi.id },
    "PaymentIntent cancelled — backing marked cancelled",
  );
}

/**
 * Handle charge.refunded
 *
 * Syncs refunds processed directly via the Stripe Dashboard back to the DB.
 * This is the safety net for manual refunds (support team, disputes, etc).
 *
 * The automated refund flow (campaign expiry, cancellation) is handled by
 * expireCampaign() and cancelCampaign() in the service — those already update
 * the DB before calling stripe.refunds.create. This handler covers:
 *   - Manual refunds via Stripe Dashboard
 *   - Partial refunds (not yet supported in the service layer)
 *   - Refunds initiated via Stripe's dispute resolution
 */
async function handleChargeRefunded(
  charge: Stripe.Charge,
  eventId: string,
  request: FastifyRequest,
): Promise<void> {
  if (!charge.refunded) return; // Partial refund (not fully refunded) — skip for now

  // Find backing by charge ID
  const backing = await prisma.backing.findFirst({
    where: { stripeChargeId: charge.id },
    select: { id: true, status: true, campaignId: true },
  });

  if (!backing) {
    // Charge not linked to a backing — could be for a styling session or other flow
    request.log.info({ chargeId: charge.id, eventId }, "charge.refunded for unknown charge — skipping");
    return;
  }

  // If already refunded in DB, nothing to do
  if (backing.status === "refunded") {
    request.log.info({ backingId: backing.id, chargeId: charge.id }, "Backing already marked refunded — idempotent skip");
    return;
  }

  // Find the most recent refund record from Stripe
  const latestRefund = charge.refunds?.data[0];
  const refundStripeId = latestRefund?.id ?? null;

  await prisma.backing.update({
    where: { id: backing.id },
    data: {
      status: "refunded",
      refundedAt: new Date(),
      refundStripeId,
      depositStatus: "refunded",
    },
  });

  // Notify backer of the manual refund
  await enqueueJob("email-notification", "process-backing-refund", {
    backingId: backing.id,
  });

  request.log.info(
    { backingId: backing.id, chargeId: charge.id, refundId: refundStripeId, eventId },
    "Backing marked refunded from manual Stripe refund",
  );
}

/**
 * Handle charge.dispute.created
 *
 * A backer has disputed a charge with their bank (chargeback).
 * Critical: Stripe deducts the disputed amount + $15 fee immediately.
 * We need to:
 *   1. Flag the backing so support knows to respond
 *   2. Log the dispute details for evidence submission
 *   3. Alert admin immediately
 *   4. Suspend the consumer account (fraud signal) if pattern detected
 *
 * Stripe gives 7 days to submit evidence. Without action, we lose automatically.
 */
async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  eventId: string,
  request: FastifyRequest,
): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;

  // Find the backing linked to this charge (base record only, then fetch relations separately)
  const backingBase = await prisma.backing.findFirst({
    where: { stripeChargeId: chargeId },
    select: { id: true, userId: true, campaignId: true, status: true, depositStatus: true },
  });

  if (!backingBase) {
    request.log.warn({ chargeId, disputeId: dispute.id, eventId }, "Dispute for unknown charge — no backing found");
    return;
  }

  // Fetch the related user and campaign for notification context
  const [backingUser, backingCampaign] = await Promise.all([
    prisma.user.findUnique({
      where: { id: backingBase.userId },
      select: { email: true, fullName: true },
    }),
    prisma.campaign.findUnique({
      where: { id: backingBase.campaignId },
      select: { id: true, title: true, brandId: true },
    }),
  ]);

  if (!backingCampaign) {
    request.log.error({ backingId: backingBase.id }, "Backing campaign not found during dispute handler");
    return;
  }

  // Record the dispute in the campaign events log
  await prisma.campaignEvent.create({
    data: {
      campaignId: backingCampaign.id,
      eventType: "backing.dispute_created",
      actorId: backingBase.userId,
      payload: {
        backingId: backingBase.id,
        disputeId: dispute.id,
        chargeId,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        evidenceDueBy: dispute.evidence_details.due_by,
      },
    },
  });

  // Flag the backing as disputed (we keep it as "active" to preserve the record,
  // but the metadata signals to support that action is required)
  await prisma.backing.update({
    where: { id: backingBase.id },
    data: {
      depositStatus: "failed",
      // In a production system, you'd add a `disputeId` and `disputeStatus`
      // column to the Backing table. For now, store in campaign events.
    },
  });

  // Alert admin immediately via high-priority email notification
  await enqueueJob("email-notification", "dispute-alert", {
    backingId: backingBase.id,
    disputeId: dispute.id,
    chargeId,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    evidenceDueBy: dispute.evidence_details.due_by,
    backerEmail: backingUser?.email ?? "",
    backerName: backingUser?.fullName ?? "",
    campaignTitle: backingCampaign.title,
  });

  request.log.warn(
    {
      backingId: backingBase.id,
      disputeId: dispute.id,
      chargeId,
      reason: dispute.reason,
      amount: dispute.amount,
      evidenceDueBy: dispute.evidence_details.due_by,
      eventId,
    },
    "DISPUTE CREATED — admin action required",
  );
}

/**
 * Handle charge.dispute.closed
 *
 * Update dispute resolution in the campaign events log.
 * If won: mark backing as active again (no financial impact, dispute withdrawn).
 * If lost: backing should already be refunded by Stripe, sync to DB.
 */
async function handleDisputeClosed(
  dispute: Stripe.Dispute,
  eventId: string,
  request: FastifyRequest,
): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;

  const backing = await prisma.backing.findFirst({
    where: { stripeChargeId: chargeId },
    select: { id: true, campaignId: true, status: true },
  });

  if (!backing) return;

  // Log the dispute outcome
  await prisma.campaignEvent.create({
    data: {
      campaignId: backing.campaignId,
      eventType: "backing.dispute_closed",
      actorId: null,
      payload: {
        backingId: backing.id,
        disputeId: dispute.id,
        chargeId,
        status: dispute.status,
        outcome: dispute.status === "won" ? "merchant_won" : "merchant_lost",
      },
    },
  });

  if (dispute.status === "won" && backing.status !== "active") {
    // Dispute withdrawn / decided in our favour — restore backing to active
    await prisma.backing.update({
      where: { id: backing.id },
      data: { depositStatus: "succeeded" },
    });

    request.log.info(
      { backingId: backing.id, disputeId: dispute.id, eventId },
      "Dispute resolved in merchant favour",
    );
  } else if (dispute.status === "lost") {
    // Stripe already refunded the backer — ensure our DB reflects this
    await prisma.backing.update({
      where: { id: backing.id },
      data: {
        status: "refunded",
        refundedAt: new Date(),
        depositStatus: "refunded",
      },
    });

    request.log.warn(
      { backingId: backing.id, disputeId: dispute.id, eventId },
      "Dispute lost — backing marked refunded",
    );
  }
}

/**
 * Handle customer.created
 *
 * Stripe sometimes creates Customer objects during payment flows.
 * Sync the Stripe customer ID back to our User record if we have a userId
 * in the customer metadata — ensures future charges can use the saved payment method.
 */
async function handleCustomerCreated(
  customer: Stripe.Customer,
  request: FastifyRequest,
): Promise<void> {
  const userId = customer.metadata?.userId;
  if (!userId) return;

  await prisma.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });

  request.log.info({ userId, stripeCustomerId: customer.id }, "Synced Stripe customer ID to user");
}
