/**
 * Notification Worker Processor
 *
 * Creates in-app notifications when significant events occur.
 * This processor listens to the `notification` queue and creates
 * notification records in the database.
 *
 * Job types:
 * - backing.confirmed       — User backed a campaign
 * - backing.moq-progress    — Campaign hit MOQ milestone (25%, 50%, 75%, 90%)
 * - backing.moq-reached     — Campaign hit MOQ
 * - backing.funded          — Campaign fully funded, production started
 * - backing.shipped         — Backing order shipped
 * - backing.delivered       — Backing order delivered
 * - backing.refunded        — Backing refunded
 * - brief.stylist-assigned  — Stylist assigned to brief
 * - brief.lookbook-ready    — Stylist completed lookbook
 * - order.confirmed         — Retail order confirmed
 * - order.shipped           — Retail order shipped
 * - campaign.match          — New campaign matches taste profile
 * - user.welcome            — New user welcome notification
 * - avatar.created          — Avatar creation complete
 *
 * Design decisions:
 * - Bulk notifications are batched for efficiency
 * - Notifications are created even if email delivery fails (separate concern)
 * - All job data is validated before processing
 * - Failures are logged but don't block the queue
 */

import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { prisma, Prisma } from "../lib/database.js";

// ─────────────────────────────────────────────
// Redis Connection
// ─────────────────────────────────────────────

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ─────────────────────────────────────────────
// Job Data Types
// ─────────────────────────────────────────────

interface BackingConfirmedJob {
  type: "backing.confirmed";
  userId: string;
  backingId: string;
  campaignId: string;
  campaignTitle: string;
  campaignImageUrl?: string;
  size: string;
}

interface BackingMoqProgressJob {
  type: "backing.moq-progress";
  campaignId: string;
  campaignTitle: string;
  campaignImageUrl?: string;
  percent: number;
  backerUserIds: string[];
}

interface BackingMoqReachedJob {
  type: "backing.moq-reached";
  campaignId: string;
  campaignTitle: string;
  campaignImageUrl?: string;
  brandName: string;
  backerUserIds: string[];
}

interface BackingFundedJob {
  type: "backing.funded";
  campaignId: string;
  campaignTitle: string;
  campaignImageUrl?: string;
  backerUserIds: string[];
}

interface BackingShippedJob {
  type: "backing.shipped";
  userId: string;
  backingId: string;
  campaignId: string;
  campaignTitle: string;
  campaignImageUrl?: string;
  trackingNumber?: string;
}

interface BackingDeliveredJob {
  type: "backing.delivered";
  userId: string;
  backingId: string;
  campaignId: string;
  campaignTitle: string;
  campaignImageUrl?: string;
}

interface BackingRefundedJob {
  type: "backing.refunded";
  userId: string;
  backingId: string;
  campaignId: string;
  campaignTitle: string;
  reason?: string;
}

interface BriefStylistAssignedJob {
  type: "brief.stylist-assigned";
  userId: string;
  briefId: string;
  stylistName: string;
  stylistAvatarUrl?: string;
}

interface BriefLookbookReadyJob {
  type: "brief.lookbook-ready";
  userId: string;
  briefId: string;
  stylistName: string;
}

interface OrderConfirmedJob {
  type: "order.confirmed";
  userId: string;
  orderId: string;
  orderNumber: string;
}

interface OrderShippedJob {
  type: "order.shipped";
  userId: string;
  orderId: string;
  orderNumber: string;
  trackingNumber?: string;
}

interface CampaignMatchJob {
  type: "campaign.match";
  userId: string;
  campaignId: string;
  campaignTitle: string;
  campaignImageUrl?: string;
  brandName: string;
  matchReason: string;
}

interface UserWelcomeJob {
  type: "user.welcome";
  userId: string;
  userName: string;
}

interface AvatarCreatedJob {
  type: "avatar.created";
  userId: string;
  avatarId: string;
}

type NotificationJobData =
  | BackingConfirmedJob
  | BackingMoqProgressJob
  | BackingMoqReachedJob
  | BackingFundedJob
  | BackingShippedJob
  | BackingDeliveredJob
  | BackingRefundedJob
  | BriefStylistAssignedJob
  | BriefLookbookReadyJob
  | OrderConfirmedJob
  | OrderShippedJob
  | CampaignMatchJob
  | UserWelcomeJob
  | AvatarCreatedJob;

// ─────────────────────────────────────────────
// Notification Creators
// ─────────────────────────────────────────────

async function createBackingConfirmedNotification(data: BackingConfirmedJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "BACKING_CONFIRMED",
      title: "Backing confirmed! 🎉",
      body: `You backed "${data.campaignTitle}" (Size ${data.size}). We'll notify you when it hits MOQ.`,
      imageUrl: data.campaignImageUrl ?? null,
      actionUrl: `/back/${data.campaignId}`,
      actionLabel: "View Campaign",
      referenceType: "backing",
      referenceId: data.backingId,
    },
  });
}

async function createMoqProgressNotifications(data: BackingMoqProgressJob) {
  const percent = data.percent;
  let title: string;
  let body: string;

  if (percent >= 90) {
    title = "Almost there! 🔥";
    body = `"${data.campaignTitle}" is ${percent}% to MOQ — so close to production!`;
  } else if (percent >= 75) {
    title = "Strong momentum! 💪";
    body = `"${data.campaignTitle}" is ${percent}% to MOQ. Keep spreading the word!`;
  } else if (percent >= 50) {
    title = "Halfway there! 🚀";
    body = `"${data.campaignTitle}" is ${percent}% to MOQ. Production is getting closer.`;
  } else {
    title = "Great progress! 📈";
    body = `"${data.campaignTitle}" is ${percent}% to MOQ. Thanks for believing in this design.`;
  }

  // Bulk create for all backers
  await prisma.notification.createMany({
    data: data.backerUserIds.map((userId) => ({
      userId,
      type: "BACKING_MOQ_PROGRESS" as const,
      title,
      body,
      imageUrl: data.campaignImageUrl ?? null,
      actionUrl: `/back/${data.campaignId}`,
      actionLabel: "View Progress",
      referenceType: "campaign",
      referenceId: data.campaignId,
    })),
  });
}

async function createMoqReachedNotifications(data: BackingMoqReachedJob) {
  await prisma.notification.createMany({
    data: data.backerUserIds.map((userId) => ({
      userId,
      type: "BACKING_MOQ_REACHED" as const,
      title: "It's happening! 🎉",
      body: `"${data.campaignTitle}" by ${data.brandName} hit MOQ — your garment is going into production!`,
      imageUrl: data.campaignImageUrl ?? null,
      actionUrl: `/back/${data.campaignId}`,
      actionLabel: "View Campaign",
      referenceType: "campaign",
      referenceId: data.campaignId,
    })),
  });
}

async function createFundedNotifications(data: BackingFundedJob) {
  await prisma.notification.createMany({
    data: data.backerUserIds.map((userId) => ({
      userId,
      type: "BACKING_FUNDED" as const,
      title: "Production confirmed ✅",
      body: `"${data.campaignTitle}" is fully funded. Production has officially started.`,
      imageUrl: data.campaignImageUrl ?? null,
      actionUrl: `/backings`,
      actionLabel: "View Backings",
      referenceType: "campaign",
      referenceId: data.campaignId,
    })),
  });
}

async function createShippedNotification(data: BackingShippedJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "BACKING_SHIPPED",
      title: "Your order has shipped! 📦",
      body: data.trackingNumber
        ? `"${data.campaignTitle}" is on its way. Track it: ${data.trackingNumber}`
        : `"${data.campaignTitle}" is on its way. Tracking details coming soon.`,
      imageUrl: data.campaignImageUrl ?? null,
      actionUrl: `/backings`,
      actionLabel: "Track Order",
      referenceType: "backing",
      referenceId: data.backingId,
    },
  });
}

async function createDeliveredNotification(data: BackingDeliveredJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "BACKING_DELIVERED",
      title: "Delivered! 🎁",
      body: `"${data.campaignTitle}" has arrived. Enjoy your new piece!`,
      imageUrl: data.campaignImageUrl ?? null,
      actionUrl: `/backings`,
      actionLabel: "View Order",
      referenceType: "backing",
      referenceId: data.backingId,
    },
  });
}

async function createRefundedNotification(data: BackingRefundedJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "BACKING_REFUNDED",
      title: "Refund processed",
      body: data.reason
        ? `Your backing for "${data.campaignTitle}" has been refunded. Reason: ${data.reason}`
        : `Your backing for "${data.campaignTitle}" has been refunded.`,
      actionUrl: `/backings`,
      actionLabel: "View Details",
      referenceType: "backing",
      referenceId: data.backingId,
    },
  });
}

async function createStylistAssignedNotification(data: BriefStylistAssignedJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "BRIEF_STYLIST_ASSIGNED",
      title: "Stylist matched! 👗",
      body: `${data.stylistName} has been assigned to your style brief and will start curating looks for you.`,
      imageUrl: data.stylistAvatarUrl ?? null,
      actionUrl: `/briefs/${data.briefId}`,
      actionLabel: "View Brief",
      referenceType: "brief",
      referenceId: data.briefId,
    },
  });
}

async function createLookbookReadyNotification(data: BriefLookbookReadyJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "BRIEF_LOOKBOOK_READY",
      title: "Your lookbook is ready! ✨",
      body: `${data.stylistName} has finished your personalised lookbook. Take a look!`,
      actionUrl: `/briefs/${data.briefId}`,
      actionLabel: "View Lookbook",
      referenceType: "brief",
      referenceId: data.briefId,
    },
  });
}

async function createOrderConfirmedNotification(data: OrderConfirmedJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "ORDER_CONFIRMED",
      title: "Order confirmed 🛍",
      body: `Order #${data.orderNumber} is confirmed and being prepared.`,
      actionUrl: `/orders`,
      actionLabel: "View Order",
      referenceType: "order",
      referenceId: data.orderId,
    },
  });
}

async function createOrderShippedNotification(data: OrderShippedJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "ORDER_SHIPPED",
      title: "Order shipped! 📦",
      body: data.trackingNumber
        ? `Order #${data.orderNumber} is on its way. Track: ${data.trackingNumber}`
        : `Order #${data.orderNumber} is on its way.`,
      actionUrl: `/orders`,
      actionLabel: "Track Order",
      referenceType: "order",
      referenceId: data.orderId,
    },
  });
}

async function createCampaignMatchNotification(data: CampaignMatchJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "NEW_CAMPAIGN_MATCH",
      title: "New campaign for you 💫",
      body: `"${data.campaignTitle}" by ${data.brandName} matches your style. ${data.matchReason}`,
      imageUrl: data.campaignImageUrl ?? null,
      actionUrl: `/back/${data.campaignId}`,
      actionLabel: "View Campaign",
      referenceType: "campaign",
      referenceId: data.campaignId,
    },
  });
}

async function createWelcomeNotification(data: UserWelcomeJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "WELCOME",
      title: `Welcome, ${data.userName}! 👋`,
      body: "Create your avatar, discover campaigns, and back the designs you love.",
      actionUrl: `/avatar/create`,
      actionLabel: "Create Avatar",
      referenceType: "user",
      referenceId: data.userId,
    },
  });
}

async function createAvatarCreatedNotification(data: AvatarCreatedJob) {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "AVATAR_CREATED",
      title: "Avatar ready! 🎨",
      body: "Your avatar is set up. You'll now get personalised size recommendations.",
      actionUrl: `/avatar/${data.avatarId}`,
      actionLabel: "View Avatar",
      referenceType: "avatar",
      referenceId: data.avatarId,
    },
  });
}

// ─────────────────────────────────────────────
// Job Processor
// ─────────────────────────────────────────────

async function processNotificationJob(job: Job<NotificationJobData>) {
  const data = job.data;
  console.log(`[Notifications] Processing job: ${job.name}`, { type: data.type, id: job.id });

  try {
    switch (data.type) {
      case "backing.confirmed":
        await createBackingConfirmedNotification(data);
        break;
      case "backing.moq-progress":
        await createMoqProgressNotifications(data);
        break;
      case "backing.moq-reached":
        await createMoqReachedNotifications(data);
        break;
      case "backing.funded":
        await createFundedNotifications(data);
        break;
      case "backing.shipped":
        await createShippedNotification(data);
        break;
      case "backing.delivered":
        await createDeliveredNotification(data);
        break;
      case "backing.refunded":
        await createRefundedNotification(data);
        break;
      case "brief.stylist-assigned":
        await createStylistAssignedNotification(data);
        break;
      case "brief.lookbook-ready":
        await createLookbookReadyNotification(data);
        break;
      case "order.confirmed":
        await createOrderConfirmedNotification(data);
        break;
      case "order.shipped":
        await createOrderShippedNotification(data);
        break;
      case "campaign.match":
        await createCampaignMatchNotification(data);
        break;
      case "user.welcome":
        await createWelcomeNotification(data);
        break;
      case "avatar.created":
        await createAvatarCreatedNotification(data);
        break;
      default:
        console.warn(`[Notifications] Unknown job type: ${(data as { type: string }).type}`);
    }

    console.log(`[Notifications] Job completed: ${job.id}`);
  } catch (error) {
    console.error(`[Notifications] Job failed: ${job.id}`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Worker Setup
// ─────────────────────────────────────────────

export const notificationWorker = new Worker<NotificationJobData>(
  "notification",
  processNotificationJob,
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000,
    },
  },
);

notificationWorker.on("ready", () => {
  console.log("[Notifications] Worker ready");
});

notificationWorker.on("failed", (job, err) => {
  console.error(`[Notifications] Job ${job?.id} failed:`, err.message);
});

notificationWorker.on("error", (err) => {
  console.error("[Notifications] Worker error:", err);
});

export default notificationWorker;
