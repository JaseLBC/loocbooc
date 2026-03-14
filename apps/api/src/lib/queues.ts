/**
 * BullMQ queue definitions.
 * All queues are defined here and imported by the API (to enqueue) and the
 * worker process (to process). This keeps queue names consistent.
 */

import { Queue } from "bullmq";
import { redis } from "./redis";

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
  connection: redis,
  defaultJobOptions,
});

// Shopify data sync — process Shopify webhook payloads async
export const shopifySyncQueue = new Queue("shopify-sync", {
  connection: redis,
  defaultJobOptions,
});

// Email notifications — all transactional emails via Resend
export const emailNotificationQueue = new Queue("email-notification", {
  connection: redis,
  defaultJobOptions,
});

// Capture remaining payments when MOQ is reached (for deposit_percent < 100)
export const captureRemainingPaymentsQueue = new Queue("capture-remaining-payments", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5,  // More retries for payment capture
  },
});

/**
 * Helper: enqueue a job with type safety.
 * Centralises queue selection so callers don't import each queue directly.
 */
export type QueueName =
  | "moq-threshold"
  | "shopify-sync"
  | "email-notification"
  | "capture-remaining-payments";

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
  };

  const targetQueue = queueMap[queue];
  if (!targetQueue) {
    throw new Error(`Unknown queue: ${queue}`);
  }

  await targetQueue.add(jobName, data, opts);
}
