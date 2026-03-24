/**
 * Cron job setup using BullMQ repeatable jobs.
 *
 * Two scheduled jobs:
 * 1. check-moq-safety-net — every 15 minutes, scans for campaigns that missed
 *    their real-time MOQ trigger (race conditions, webhook delays, etc.)
 * 2. expire-campaigns — every hour, expires campaigns past their deadline
 *    that haven't hit MOQ, triggering the refund flow
 */

import { Queue, type ConnectionOptions } from "bullmq";
import { redis } from "../lib/redis";

const moqThresholdQueue = new Queue("moq-threshold", { connection: redis as unknown as ConnectionOptions });
const emailNotificationQueue = new Queue("email-notification", { connection: redis as unknown as ConnectionOptions });

export async function startCronJobs(): Promise<void> {
  // MOQ safety-net: every 15 minutes
  await moqThresholdQueue.add(
    "cron-moq-safety-net",
    { type: "cron", action: "scan-all-active-campaigns" },
    {
      repeat: { pattern: "*/15 * * * *" }, // every 15 minutes
      jobId: "cron-moq-safety-net", // stable ID prevents duplicate cron registrations
    },
  );

  // Campaign expiry check: every hour
  await moqThresholdQueue.add(
    "cron-expire-campaigns",
    { type: "cron", action: "expire-past-deadline" },
    {
      repeat: { pattern: "0 * * * *" }, // every hour on the hour
      jobId: "cron-expire-campaigns",
    },
  );

  console.warn("[cron] Scheduled jobs registered: moq-safety-net (15min), expire-campaigns (1hr)");
}

// Export queues for direct access if needed
export { moqThresholdQueue, emailNotificationQueue };
