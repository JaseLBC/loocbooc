/**
 * Queue instances for use within the worker process.
 * These are the same queues as in apps/api/src/lib/queues.ts —
 * shared connection, same queue names.
 */

import { Queue } from "bullmq";
import { redis } from "../lib/redis";

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 100, age: 86400 },
  removeOnFail: { count: 500 },
};

export const moqThresholdQueue = new Queue("moq-threshold", {
  connection: redis,
  defaultJobOptions,
});

export const emailNotificationQueue = new Queue("email-notification", {
  connection: redis,
  defaultJobOptions,
});

export const captureRemainingPaymentsQueue = new Queue("capture-remaining-payments", {
  connection: redis,
  defaultJobOptions,
});

// Taste Engine — processes raw taste signals into user preference models
// Jobs are debounced per-user: rapid signal ingestion coalesces into a single run
export const tasteEngineQueue = new Queue("taste-engine", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    // Taste engine jobs can be deduplicated by userId — only run one per user at a time
    jobId: undefined, // Set per-job in enqueueTasteEngineJob
  },
});
