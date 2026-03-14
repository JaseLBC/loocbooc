/**
 * Redis client — used for rate limiting, session cache, and BullMQ queues.
 * Uses ioredis pointing at Upstash Redis (or local Redis in development).
 */

import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redis;
