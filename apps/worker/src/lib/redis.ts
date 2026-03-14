/**
 * Redis client for the worker process.
 * Same connection config as the API — points to the same Redis instance.
 */

import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("Worker Redis connection error:", err);
});

export default redis;
