/**
 * @loocbooc/database — main entry point.
 * Exports the Prisma client and generated types.
 */

export { prisma, default } from "./client";
// Re-export Prisma namespace and types
export * from "../generated/client";
export { Prisma, PrismaClient } from "../generated/client";

// Re-export model types for use in services
export type {
  User,
  Brand,
  BrandMember,
  Garment,
  SKU,
  Manufacturer,
  Avatar,
  AvatarFitResult,
  Campaign,
  Backing,
  CampaignSizeBreak,
  CampaignEvent,
  Order,
  OrderItem,
  Stylist,
  StylistPortfolioItem,
  StyleBrief,
} from "../generated/client";
