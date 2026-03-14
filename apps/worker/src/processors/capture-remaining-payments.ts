/**
 * Capture remaining payments worker.
 * Used when deposit_percent < 100: after MOQ is reached, charge the remaining
 * balance for each active backing.
 *
 * Retry logic: 5 attempts over 48 hours. After all retries fail, the backer
 * is notified to update their payment method (7-day grace window, then cancel).
 *
 * Note: For MVP, deposit_percent defaults to 100 so this worker is dormant.
 * It's ready for v1.1 when the deposit model launches.
 */

import { Worker } from "bullmq";
import Stripe from "stripe";
import { redis } from "../lib/redis";
import { prisma } from "../../../../packages/database/src/client";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "", {
  apiVersion: "2023-10-16",
});

interface CaptureJobData {
  campaignId?: string;
  backingId?: string;
}

export const captureRemainingPaymentsWorker = new Worker(
  "capture-remaining-payments",
  async (job) => {
    const { campaignId, backingId } = job.data as CaptureJobData;

    if (backingId) {
      // Single backing capture (retry flow)
      await captureRemainingForBacking(backingId, job.attemptsMade);
      return { processed: 1 };
    }

    if (campaignId) {
      // Capture all remaining payments for a campaign on MOQ reached
      const backings = await prisma.backing.findMany({
        where: {
          campaignId,
          status: "active",
          finalPaymentStatus: "pending",
          remainingCents: { gt: 0 },
        },
        select: {
          id: true,
          remainingCents: true,
          currency: true,
          userId: true,
          stripePaymentIntentId: true,
        },
      });

      const results = await Promise.allSettled(
        backings.map((b) => captureRemainingForBacking(b.id, 0)),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      job.log(`Campaign ${campaignId}: captured ${succeeded} payments, ${failed} failed`);
      return { processed: backings.length, succeeded, failed };
    }

    throw new Error("capture-remaining-payments job requires either campaignId or backingId");
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 1000,
    },
  },
);

async function captureRemainingForBacking(backingId: string, attemptsMade: number): Promise<void> {
  const backing = await prisma.backing.findUnique({
    where: { id: backingId },
    include: { user: { select: { id: true, stripeCustomerId: true } } },
  });

  if (!backing || backing.finalPaymentStatus === "succeeded" || backing.status !== "active") {
    return;
  }

  try {
    // Create a new PaymentIntent for the remaining balance
    const paymentIntent = await stripe.paymentIntents.create({
      amount: backing.remainingCents,
      currency: backing.currency.toLowerCase(),
      customer: backing.user.stripeCustomerId ?? undefined,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        backingId,
        type: "remaining_payment",
      },
      idempotency_key: `remaining-${backingId}-${attemptsMade}`,
    });

    await prisma.backing.update({
      where: { id: backingId },
      data: {
        finalPaymentStatus: paymentIntent.status === "succeeded" ? "succeeded" : "processing",
      },
    });
  } catch (err) {
    // Payment failed — update status
    await prisma.backing.update({
      where: { id: backingId },
      data: { finalPaymentStatus: "failed" },
    });

    // After max retries, notify backer to update payment method
    if (attemptsMade >= 4) {
      const { emailNotificationQueue } = await import("../queues/queues");
      await emailNotificationQueue.add("payment-update-required", {
        backingId,
        type: "final_payment_failed",
      });
    }

    throw err; // Re-throw to trigger BullMQ retry
  }
}

captureRemainingPaymentsWorker.on("failed", (job, err) => {
  console.error(`[capture-remaining-payments] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
});
