/**
 * Queue instances for use within the worker process.
 * These are the same queues as in apps/api/src/lib/queues.ts —
 * shared connection, same queue names.
 */

import { Queue, type ConnectionOptions } from "bullmq";
import { redis } from "../lib/redis";

const redisConnection = redis as unknown as ConnectionOptions;

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 100, age: 86400 },
  removeOnFail: { count: 500 },
};

export const moqThresholdQueue = new Queue("moq-threshold", {
  connection: redisConnection,
  defaultJobOptions,
});

export const emailNotificationQueue = new Queue("email-notification", {
  connection: redisConnection,
  defaultJobOptions,
});

export const captureRemainingPaymentsQueue = new Queue("capture-remaining-payments", {
  connection: redisConnection,
  defaultJobOptions,
});

// Taste Engine — processes raw taste signals into user preference models
// Jobs are debounced per-user: rapid signal ingestion coalesces into a single run
export const tasteEngineQueue = new Queue("taste-engine", {
  connection: redisConnection,
  defaultJobOptions,
});

// Notification — creates in-app notifications for consumers
// High throughput: bulk notifications for campaign events (MOQ reached, funded)
export const notificationQueue = new Queue("notification", {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2, // Notifications are less critical than payments
    backoff: { type: "exponential" as const, delay: 1000 },
  },
});
