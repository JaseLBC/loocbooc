/**
 * User entity types — shared across all modules.
 * Matches the `users` table in the Prisma schema exactly.
 */

// UserRole is defined authoritatively in ./auth — import from there.
import type { UserRoleType } from "./auth";

export type UserStatus = "active" | "suspended" | "deleted";

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  fullName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRoleType;
  status: UserStatus;
  stripeCustomerId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface CreateUserInput {
  email: string;
  fullName?: string;
  displayName?: string;
  role?: UserRole;
  phone?: string;
}

export interface UpdateUserInput {
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}
