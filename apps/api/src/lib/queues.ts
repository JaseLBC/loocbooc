/**
 * BullMQ queue definitions.
 * All queues are defined here and imported by the API (to enqueue) and the
 * worker process (to process). This keeps queue names consistent.
 */

import { Queue } from "bullmq";

// Use connection string directly instead of Redis instance to avoid ioredis version mismatch
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const connectionOptions = {
  url: REDIS_URL,
  maxRetriesPerRequest: null as null, // Required by BullMQ
  enableReadyCheck: false,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,    // Keep last 100 completed jobs for debugging
    age: 86400,   // Remove after 24 hours
  },
  removeOnFail: {
    count: 500,   // Keep more failed jobs for investigation
  },
};

// MOQ threshold check — runs on every successful backing payment
// Also triggered by the scheduled safety-net cron job
export const moqThresholdQueue = new Queue("moq-threshold", {
  connection: connectionOptions,
  defaultJobOptions,
});

// Shopify data sync — process Shopify webhook payloads async
export const shopifySyncQueue = new Queue("shopify-sync", {
  connection: connectionOptions,
  defaultJobOptions,
});

// Email notifications — all transactional emails via Resend
export const emailNotificationQueue = new Queue("email-notification", {
  connection: connectionOptions,
  defaultJobOptions,
});

// Capture remaining payments when MOQ is reached (for deposit_percent < 100)
export const captureRemainingPaymentsQueue = new Queue("capture-remaining-payments", {
  connection: connectionOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5,  // More retries for payment capture
  },
});

// Taste Engine — processes raw taste signals into user preference models
// Jobs are deduplicated per-user: if a job for that user is already pending/delayed,
// adding another has no effect (BullMQ deduplication via jobId)
export const tasteEngineQueue = new Queue("taste-engine", {
  connection: connectionOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    // Delay processing by 5 minutes — batches rapid signal bursts into one run
    delay: 5 * 60 * 1000,
  },
});

// Notification — in-app notifications for consumers
// Lower retry count than payments (notifications are not critical path)
export const notificationQueue = new Queue("notification", {
  connection: connectionOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    backoff: {
      type: "exponential" as const,
      delay: 1000,
    },
  },
});

/**
 * Enqueue a taste engine processing job for a user.
 * Uses the userId as the jobId for deduplication — if one is already queued,
 * the new one is dropped (avoiding redundant reprocessing during active sessions).
 */
export async function enqueueTasteEngineJob(
  userId: string,
  opts: { immediate?: boolean; forceRebuild?: boolean } = {},
): Promise<void> {
  const jobId = `taste-engine:${userId}`;

  // Check if a job already exists for this user (pending or delayed)
  const existingJob = await tasteEngineQueue.getJob(jobId);
  if (existingJob && !opts.forceRebuild) {
    const state = await existingJob.getState();
    if (state === "waiting" || state === "delayed") {
      // Already queued — don't add another
      return;
    }
  }

  await tasteEngineQueue.add(
    "process-taste-signals",
    { userId, forceRebuild: opts.forceRebuild ?? false },
    {
      jobId,
      delay: opts.immediate ? 0 : 5 * 60 * 1000, // 5 min debounce by default
    },
  );
}

/**
 * Helper: enqueue a job with type safety.
 * Centralises queue selection so callers don't import each queue directly.
 */
export type QueueName =
  | "moq-threshold"
  | "shopify-sync"
  | "email-notification"
  | "capture-remaining-payments"
  | "taste-engine"
  | "notification";

export async function enqueueJob(
  queue: QueueName,
  jobName: string,
  data: Record<string, unknown>,
  opts?: { delay?: number; priority?: number },
): Promise<void> {
  const queueMap: Record<QueueName, Queue> = {
    "moq-threshold": moqThresholdQueue,
    "shopify-sync": shopifySyncQueue,
    "email-notification": emailNotificationQueue,
    "capture-remaining-payments": captureRemainingPaymentsQueue,
    "taste-engine": tasteEngineQueue,
    "notification": notificationQueue,
  };

  const targetQueue = queueMap[queue];
  if (!targetQueue) {
    throw new Error(`Unknown queue: ${queue}`);
  }

  await targetQueue.add(jobName, data, opts);
}

// ─────────────────────────────────────────────
// Notification Queue Helpers
// ─────────────────────────────────────────────

/**
 * Enqueue an in-app notification for a user.
 * Wraps the notification queue with type-safe job data.
 */
export type NotificationJobType =
  | "backing.confirmed"
  | "backing.moq-progress"
  | "backing.moq-reached"
  | "backing.funded"
  | "backing.shipped"
  | "backing.delivered"
  | "backing.refunded"
  | "brief.stylist-assigned"
  | "brief.lookbook-ready"
  | "order.confirmed"
  | "order.shipped"
  | "campaign.match"
  | "user.welcome"
  | "avatar.created";

export async function enqueueNotification(
  type: NotificationJobType,
  data: Record<string, unknown>,
): Promise<void> {
  await notificationQueue.add(type, { type, ...data });
}
