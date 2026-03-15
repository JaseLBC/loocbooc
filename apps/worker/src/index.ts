/**
 * Worker process entry point.
 * Starts all BullMQ workers and the scheduled cron jobs.
 * Runs as a separate process from the API server.
 */

import { moqThresholdWorker } from "./processors/moq-threshold";
import { shopifySyncWorker } from "./processors/shopify-sync";
import { emailNotificationWorker } from "./processors/email-notification";
import { captureRemainingPaymentsWorker } from "./processors/capture-remaining-payments";
import { tasteEngineWorker } from "./processors/taste-engine";
import { startCronJobs } from "./queues/cron";

async function start() {
  console.warn("Starting Loocbooc worker process...");

  // All workers are already initialised on import — just log their status
  console.warn("Workers started:", [
    moqThresholdWorker.name,
    shopifySyncWorker.name,
    emailNotificationWorker.name,
    captureRemainingPaymentsWorker.name,
    tasteEngineWorker.name,
  ].join(", "));

  // Start scheduled cron jobs
  await startCronJobs();

  console.warn("Worker process ready.");
}

// Graceful shutdown — wait for running jobs to complete
process.on("SIGTERM", async () => {
  console.warn("SIGTERM received — shutting down workers gracefully...");
  await Promise.all([
    moqThresholdWorker.close(),
    shopifySyncWorker.close(),
    emailNotificationWorker.close(),
    captureRemainingPaymentsWorker.close(),
    tasteEngineWorker.close(),
  ]);
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.warn("SIGINT received — shutting down workers gracefully...");
  await Promise.all([
    moqThresholdWorker.close(),
    shopifySyncWorker.close(),
    emailNotificationWorker.close(),
    captureRemainingPaymentsWorker.close(),
    tasteEngineWorker.close(),
  ]);
  process.exit(0);
});

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
