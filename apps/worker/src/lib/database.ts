/**
 * Database client re-export for the worker process.
 * Uses the Prisma client from the database package.
 */

// Import from the database package's generated client
import { PrismaClient, Prisma } from "@loocbooc/database/generated/client";

// Create a singleton Prisma client
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma namespace and Decimal from it
export { Prisma };
export const Decimal = Prisma.Decimal;
export type { PrismaClient };
