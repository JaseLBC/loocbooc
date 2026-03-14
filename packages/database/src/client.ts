/**
 * Prisma client singleton.
 * Ensures a single PrismaClient instance in development (prevents hot-reload
 * from creating too many connections) and production.
 */

import { PrismaClient } from "../generated/client";

// Extend global to store the Prisma instance during development
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// In development, reuse the global instance to survive hot reloads
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  global.__prisma = prisma;
}

export default prisma;
