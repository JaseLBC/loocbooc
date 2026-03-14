/**
 * MOQ threshold worker — processes the "check-moq-threshold" job.
 *
 * This is the core Back It trigger logic. Two paths lead here:
 * 1. Real-time: enqueued immediately after every successful backing payment
 * 2. Safety-net cron: runs every 15 minutes, checks all active campaigns
 *
 * The underlying service function is idempotent — safe to call multiple times.
 */

import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../../../../packages/database/src/client";

export const moqThresholdWorker = new Worker(
  "moq-threshold",
  async (job) => {
    const { campaignId } = job.data as { campaignId?: string };

    if (!campaignId) {
      throw new Error("moq-threshold job missing campaignId");
    }

    job.log(`Checking MOQ threshold for campaign ${campaignId}`);

    // Fetch current campaign state
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
        status: true,
      },
    });

    if (!campaign) {
      job.log(`Campaign ${campaignId} not found — skipping`);
      return { skipped: true, reason: "campaign_not_found" };
    }

    if (campaign.moqReached || campaign.status !== "active") {
      job.log(`Campaign ${campaignId} already triggered or not active — skipping`);
      return { skipped: true, reason: "already_triggered_or_inactive" };
    }

    if (campaign.currentBackingCount < campaign.moq) {
      job.log(`Campaign ${campaignId}: ${campaign.currentBackingCount}/${campaign.moq} — MOQ not yet reached`);
      return { moqReached: false, current: campaign.currentBackingCount, moq: campaign.moq };
    }

    job.log(`Campaign ${campaignId}: MOQ reached! ${campaign.currentBackingCount}/${campaign.moq} — triggering flow`);

    // Atomic update with idempotency guard
    const updated = await prisma.campaign.updateMany({
      where: { id: campaignId, moqReached: false },
      data: {
        moqReached: true,
        moqReachedAt: new Date(),
        status: "moq_reached",
      },
    });

    if (updated.count === 0) {
      job.log(`Campaign ${campaignId}: idempotency guard hit — another process already triggered MOQ`);
      return { skipped: true, reason: "idempotency_guard" };
    }

    // Immediately update to funded
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "funded" },
    });

    // Record the event
    await prisma.campaignEvent.create({
      data: {
        campaignId,
        eventType: "campaign.moq_reached",
        payload: {
          backingCount: campaign.currentBackingCount,
          moq: campaign.moq,
          triggeredBy: "moq-threshold-worker",
        },
      },
    });

    // Enqueue downstream notifications
    const { emailNotificationQueue } = await import("../queues/queues");

    if (campaign.manufacturerId) {
      await emailNotificationQueue.add("manufacturer-notification", {
        campaignId,
        manufacturerId: campaign.manufacturerId,
        type: "moq_reached",
      });
      job.log(`Enqueued manufacturer notification for campaign ${campaignId}`);
    }

    await emailNotificationQueue.add("moq-reached-backer-emails", {
      campaignId,
      type: "moq_reached_backers",
    });

    job.log(`MOQ trigger complete for campaign ${campaignId}`);

    return {
      moqReached: true,
      campaignId,
      backingCount: campaign.currentBackingCount,
      moq: campaign.moq,
    };
  },
  {
    connection: redis,
    concurrency: 10, // Can check multiple campaigns concurrently
    limiter: {
      max: 100,
      duration: 1000,
    },
  },
);

moqThresholdWorker.on("completed", (job, result) => {
  if (!result.skipped) {
    console.warn(`[moq-threshold] Job ${job.id} completed:`, JSON.stringify(result));
  }
});

moqThresholdWorker.on("failed", (job, err) => {
  console.error(`[moq-threshold] Job ${job?.id} failed:`, err.message);
});
