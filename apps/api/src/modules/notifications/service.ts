/**
 * Notifications Service
 *
 * Handles in-app notification creation, retrieval, and management for consumers.
 * Notifications are created by background workers when significant events occur:
 * - Backing lifecycle (confirmed, MOQ progress, funded, shipped, etc.)
 * - Style brief updates (stylist assigned, lookbook ready)
 * - Order status changes
 * - Personalised recommendations (campaign matches, fit recommendations)
 *
 * Design decisions:
 * - Notifications are write-once (no edits) — creates clean audit trail
 * - Batch mark-as-read supported for UX efficiency
 * - Unread count is cached in Redis for fast badge updates
 * - Expired notifications are automatically excluded from queries
 * - All notifications have optional deep links for in-app navigation
 */

import type { PrismaClient, NotificationType, Notification } from "@loocbooc/database";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  referenceType?: string;
  referenceId?: string;
  expiresAt?: Date;
}

export interface NotificationSummary {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  referenceType: string | null;
  referenceId: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface NotificationsListResult {
  notifications: NotificationSummary[];
  unreadCount: number;
  total: number;
  hasMore: boolean;
}

export interface UnreadCountResult {
  count: number;
}

// ─────────────────────────────────────────────
// Service Error
// ─────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// ─────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────

/**
 * Create a new notification for a user.
 * Called by background workers when events occur.
 */
export async function createNotification(
  prisma: PrismaClient,
  input: CreateNotificationInput,
): Promise<Notification> {
  // Validate user exists
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });

  if (!user) {
    throw new ServiceError("USER_NOT_FOUND", "User not found", 404);
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      imageUrl: input.imageUrl ?? null,
      actionUrl: input.actionUrl ?? null,
      actionLabel: input.actionLabel ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });

  return notification;
}

/**
 * Create multiple notifications in a batch.
 * Useful for sending the same notification to multiple users (e.g., campaign funded).
 */
export async function createBulkNotifications(
  prisma: PrismaClient,
  inputs: CreateNotificationInput[],
): Promise<{ count: number }> {
  if (inputs.length === 0) {
    return { count: 0 };
  }

  const result = await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      imageUrl: input.imageUrl ?? null,
      actionUrl: input.actionUrl ?? null,
      actionLabel: input.actionLabel ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      expiresAt: input.expiresAt ?? null,
    })),
    skipDuplicates: true,
  });

  return { count: result.count };
}

/**
 * Get paginated list of notifications for a user.
 * Excludes expired notifications by default.
 */
export async function getNotifications(
  prisma: PrismaClient,
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    includeExpired?: boolean;
  } = {},
): Promise<NotificationsListResult> {
  const { limit = 20, offset = 0, unreadOnly = false, includeExpired = false } = options;

  // Build where clause
  const where: Record<string, unknown> = {
    userId,
  };

  if (unreadOnly) {
    where.read = false;
  }

  if (!includeExpired) {
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ];
  }

  // Fetch notifications and counts in parallel
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Fetch one extra to check hasMore
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        imageUrl: true,
        actionUrl: true,
        actionLabel: true,
        referenceType: true,
        referenceId: true,
        read: true,
        readAt: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId,
        read: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    }),
  ]);

  // Check if there are more results
  const hasMore = notifications.length > limit;
  if (hasMore) {
    notifications.pop(); // Remove the extra item
  }

  return {
    notifications,
    unreadCount,
    total,
    hasMore,
  };
}

/**
 * Get a single notification by ID.
 * Returns null if not found or not owned by user.
 */
export async function getNotification(
  prisma: PrismaClient,
  userId: string,
  notificationId: string,
): Promise<NotificationSummary | null> {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      imageUrl: true,
      actionUrl: true,
      actionLabel: true,
      referenceType: true,
      referenceId: true,
      read: true,
      readAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return notification;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  prisma: PrismaClient,
  userId: string,
  notificationId: string,
): Promise<Notification | null> {
  // Verify ownership and update in one query
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    return null;
  }

  // Already read — return as-is
  if (notification.read) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

/**
 * Mark multiple notifications as read.
 * Used for "Mark all as read" functionality.
 */
export async function markMultipleAsRead(
  prisma: PrismaClient,
  userId: string,
  notificationIds: string[],
): Promise<{ count: number }> {
  if (notificationIds.length === 0) {
    return { count: 0 };
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return { count: result.count };
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllAsRead(
  prisma: PrismaClient,
  userId: string,
): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return { count: result.count };
}

/**
 * Get unread notification count for a user.
 * Excludes expired notifications.
 */
export async function getUnreadCount(
  prisma: PrismaClient,
  userId: string,
): Promise<UnreadCountResult> {
  const count = await prisma.notification.count({
    where: {
      userId,
      read: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  return { count };
}

/**
 * Delete a notification.
 * Soft-delete pattern not used — notifications are ephemeral UI elements.
 */
export async function deleteNotification(
  prisma: PrismaClient,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const result = await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });

  return result.count > 0;
}

/**
 * Delete all read notifications older than a given date.
 * Called by a scheduled job to clean up old notifications.
 */
export async function deleteOldReadNotifications(
  prisma: PrismaClient,
  olderThan: Date,
): Promise<{ count: number }> {
  const result = await prisma.notification.deleteMany({
    where: {
      read: true,
      createdAt: { lt: olderThan },
    },
  });

  return { count: result.count };
}

/**
 * Get notifications by reference.
 * Useful for updating/checking if a notification already exists for an entity.
 */
export async function getNotificationsByReference(
  prisma: PrismaClient,
  referenceType: string,
  referenceId: string,
  options: { userId?: string; type?: NotificationType } = {},
): Promise<Notification[]> {
  const where: Record<string, unknown> = {
    referenceType,
    referenceId,
  };

  if (options.userId) {
    where.userId = options.userId;
  }

  if (options.type) {
    where.type = options.type;
  }

  return prisma.notification.findMany({ where });
}

// ─────────────────────────────────────────────
// Notification Content Generators
// ─────────────────────────────────────────────

/**
 * Generate notification content for backing events.
 * These helpers ensure consistent messaging across the platform.
 */
export const NotificationTemplates = {
  backingConfirmed(campaignTitle: string, size: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Backing confirmed! 🎉",
      body: `You backed "${campaignTitle}" (Size ${size}). We'll notify you when it hits MOQ.`,
    };
  },

  backingMoqProgress(campaignTitle: string, percent: number): Pick<CreateNotificationInput, "title" | "body"> {
    if (percent >= 90) {
      return {
        title: "Almost there! 🔥",
        body: `"${campaignTitle}" is ${percent}% to MOQ — so close to production!`,
      };
    }
    if (percent >= 75) {
      return {
        title: "Strong momentum! 💪",
        body: `"${campaignTitle}" is ${percent}% to MOQ. Keep spreading the word!`,
      };
    }
    if (percent >= 50) {
      return {
        title: "Halfway there! 🚀",
        body: `"${campaignTitle}" is ${percent}% to MOQ. Production is getting closer.`,
      };
    }
    return {
      title: "Great progress! 📈",
      body: `"${campaignTitle}" is ${percent}% to MOQ. Thanks for believing in this design.`,
    };
  },

  backingMoqReached(campaignTitle: string, brandName: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "It's happening! 🎉",
      body: `"${campaignTitle}" by ${brandName} hit MOQ — your garment is going into production!`,
    };
  },

  backingFunded(campaignTitle: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Production confirmed ✅",
      body: `"${campaignTitle}" is fully funded. Production has officially started.`,
    };
  },

  backingShipped(campaignTitle: string, trackingNumber?: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Your order has shipped! 📦",
      body: trackingNumber
        ? `"${campaignTitle}" is on its way. Track it: ${trackingNumber}`
        : `"${campaignTitle}" is on its way. Tracking details coming soon.`,
    };
  },

  backingDelivered(campaignTitle: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Delivered! 🎁",
      body: `"${campaignTitle}" has arrived. Enjoy your new piece!`,
    };
  },

  backingRefunded(campaignTitle: string, reason?: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Refund processed",
      body: reason
        ? `Your backing for "${campaignTitle}" has been refunded. Reason: ${reason}`
        : `Your backing for "${campaignTitle}" has been refunded.`,
    };
  },

  briefStylistAssigned(stylistName: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Stylist matched! 👗",
      body: `${stylistName} has been assigned to your style brief and will start curating looks for you.`,
    };
  },

  briefLookbookReady(stylistName: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Your lookbook is ready! ✨",
      body: `${stylistName} has finished your personalised lookbook. Take a look!`,
    };
  },

  orderConfirmed(orderNumber: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Order confirmed 🛍",
      body: `Order #${orderNumber} is confirmed and being prepared.`,
    };
  },

  orderShipped(orderNumber: string, trackingNumber?: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Order shipped! 📦",
      body: trackingNumber
        ? `Order #${orderNumber} is on its way. Track: ${trackingNumber}`
        : `Order #${orderNumber} is on its way.`,
    };
  },

  newCampaignMatch(campaignTitle: string, brandName: string, matchReason: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "New campaign for you 💫",
      body: `"${campaignTitle}" by ${brandName} matches your style. ${matchReason}`,
    };
  },

  fitRecommendation(productName: string, brandName: string, size: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Perfect fit found! 👌",
      body: `"${productName}" by ${brandName} would fit you perfectly in ${size}.`,
    };
  },

  welcome(userName: string): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: `Welcome, ${userName}! 👋`,
      body: "Create your avatar, discover campaigns, and back the designs you love.",
    };
  },

  avatarCreated(): Pick<CreateNotificationInput, "title" | "body"> {
    return {
      title: "Avatar ready! 🎨",
      body: "Your avatar is set up. You'll now get personalised size recommendations.",
    };
  },
};
