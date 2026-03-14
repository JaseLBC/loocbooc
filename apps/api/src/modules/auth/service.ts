/**
 * Auth service — user sync and profile management.
 * Keeps our `users` table in sync with Supabase Auth.
 */

import { prisma } from "@loocbooc/database";
import type { User } from "@loocbooc/database";

interface SyncUserInput {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

export const authService = {
  /**
   * Upsert a user record from Supabase Auth data.
   * Called on first login and on profile changes.
   */
  async syncUser(input: SyncUserInput): Promise<User> {
    return prisma.user.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        email: input.email,
        fullName: input.fullName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        emailVerified: true, // Supabase handles verification
      },
      update: {
        email: input.email,
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        lastLoginAt: new Date(),
      },
    });
  },

  /**
   * Fetch a user by their Supabase Auth ID.
   */
  async getUser(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  },

  /**
   * Update a user's last login timestamp.
   */
  async recordLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },
};
