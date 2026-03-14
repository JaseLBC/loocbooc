/**
 * @loocbooc/database — main entry point.
 * Exports the Prisma client and generated types.
 */

export { prisma, default } from "./client";
export { Prisma } from "../generated/client";
export type { PrismaClient } from "../generated/client";
