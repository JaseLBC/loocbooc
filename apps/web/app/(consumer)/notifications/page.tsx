"use client";

/**
 * Consumer Notifications Page
 *
 * Displays all in-app notifications for the authenticated consumer:
 * - Backing updates (MOQ progress, funded, shipped, delivered)
 * - Style brief responses from stylists
 * - Order status updates
 * - Personalised recommendations
 *
 * Features:
 * - Grouped by time (Today, Yesterday, This Week, Earlier)
 * - Mark individual or all as read
 * - Delete notifications
 * - Deep linking to relevant pages
 * - Pull-to-refresh on mobile (via scroll restoration)
 * - Skeleton loading states
 * - Empty state when no notifications
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type NotificationType =
  | "BACKING_CONFIRMED"
  | "BACKING_MOQ_PROGRESS"
  | "BACKING_MOQ_REACHED"
  | "BACKING_FUNDED"
  | "BACKING_IN_PRODUCTION"
  | "BACKING_SHIPPED"
  | "BACKING_DELIVERED"
  | "BACKING_CANCELLED"
  | "BACKING_REFUNDED"
  | "BRIEF_STYLIST_ASSIGNED"
  | "BRIEF_LOOKBOOK_READY"
  | "BRIEF_MESSAGE"
  | "ORDER_CONFIRMED"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "NEW_CAMPAIGN_MATCH"
  | "FIT_RECOMMENDATION"
  | "PRICE_DROP"
  | "WELCOME"
  | "AVATAR_CREATED"
  | "STYLIST_RATED";

interface Notification {
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
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchNotifications(
  token: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  if (options.unreadOnly) params.set("unreadOnly", "true");

  const res = await fetch(`${API_URL}/api/v1/notifications?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

async function fetchUnreadCount(token: string): Promise<{ count: number }> {
  const res = await fetch(`${API_URL}/api/v1/notifications/count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch count");
  return res.json();
}

async function markAsRead(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to mark as read");
}

async function markAllAsRead(token: string): Promise<{ count: number }> {
  const res = await fetch(`${API_URL}/api/v1/notifications/read-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to mark all as read");
  return res.json();
}

async function deleteNotification(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/notifications/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete notification");
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Get icon and colour for notification type.
 */
function getNotificationMeta(type: NotificationType): { icon: string; color: string } {
  const typeMap: Record<NotificationType, { icon: string; color: string }> = {
    BACKING_CONFIRMED: { icon: "🎉", color: "#10b981" },
    BACKING_MOQ_PROGRESS: { icon: "📈", color: "#3b82f6" },
    BACKING_MOQ_REACHED: { icon: "🎉", color: "#10b981" },
    BACKING_FUNDED: { icon: "✅", color: "#10b981" },
    BACKING_IN_PRODUCTION: { icon: "🏭", color: "#6366f1" },
    BACKING_SHIPPED: { icon: "📦", color: "#8b5cf6" },
    BACKING_DELIVERED: { icon: "🎁", color: "#10b981" },
    BACKING_CANCELLED: { icon: "❌", color: "#ef4444" },
    BACKING_REFUNDED: { icon: "💸", color: "#f59e0b" },
    BRIEF_STYLIST_ASSIGNED: { icon: "👗", color: "#ec4899" },
    BRIEF_LOOKBOOK_READY: { icon: "✨", color: "#ec4899" },
    BRIEF_MESSAGE: { icon: "💬", color: "#6366f1" },
    ORDER_CONFIRMED: { icon: "🛍", color: "#10b981" },
    ORDER_SHIPPED: { icon: "📦", color: "#8b5cf6" },
    ORDER_DELIVERED: { icon: "🎁", color: "#10b981" },
    NEW_CAMPAIGN_MATCH: { icon: "💫", color: "#f59e0b" },
    FIT_RECOMMENDATION: { icon: "👌", color: "#10b981" },
    PRICE_DROP: { icon: "🏷️", color: "#ef4444" },
    WELCOME: { icon: "👋", color: "#3b82f6" },
    AVATAR_CREATED: { icon: "🎨", color: "#6366f1" },
    STYLIST_RATED: { icon: "⭐", color: "#f59e0b" },
  };
  return typeMap[type] || { icon: "🔔", color: "#6b7280" };
}

/**
 * Format relative time for notification display.
 */
function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Group notifications by time period.
 */
function groupNotifications(
  notifications: Notification[],
): { label: string; items: Notification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, Notification[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Earlier: [],
  };

  for (const n of notifications) {
    const date = new Date(n.createdAt);
    if (date >= today) {
      groups["Today"].push(n);
    } else if (date >= yesterday) {
      groups["Yesterday"].push(n);
    } else if (date >= weekAgo) {
      groups["This Week"].push(n);
    } else {
      groups["Earlier"].push(n);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        background: "#f9f9f9",
        animation: "pulse 1.5s infinite",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "#e5e5e5",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ width: "60%", height: 14, background: "#e5e5e5", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: "90%", height: 12, background: "#e5e5e5", borderRadius: 4, marginBottom: 4 }} />
        <div style={{ width: "40%", height: 10, background: "#e5e5e5", borderRadius: 4 }} />
      </div>
    </div>
  );
}

function NotificationCard({
  notification,
  onRead,
  onDelete,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const { icon, color } = getNotificationMeta(notification.type);
  const [showActions, setShowActions] = useState(false);

  const handleClick = () => {
    if (!notification.read) {
      onRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={{
        display: "flex",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        background: notification.read ? "#fff" : "#f0f9ff",
        border: notification.read ? "1px solid #f0f0f0" : "1px solid #bae6fd",
        cursor: notification.actionUrl ? "pointer" : "default",
        position: "relative",
        transition: "all 0.15s ease",
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
      {/* Icon / Image */}
      {notification.imageUrl ? (
        <img
          src={notification.imageUrl}
          alt=""
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: notification.read ? 400 : 600,
            fontSize: 14,
            color: "#0a0a0a",
            marginBottom: 4,
            lineHeight: 1.4,
          }}
        >
          {notification.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#666",
            lineHeight: 1.5,
            marginBottom: 6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {notification.body}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#999" }}>
            {formatRelativeTime(notification.createdAt)}
          </span>
          {notification.actionUrl && notification.actionLabel && (
            <span style={{ fontSize: 11, color, fontWeight: 500 }}>
              {notification.actionLabel} →
            </span>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#3b82f6",
          }}
        />
      )}

      {/* Actions menu (desktop hover) */}
      {showActions && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            gap: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!notification.read && (
            <button
              onClick={() => onRead(notification.id)}
              style={{
                background: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
                color: "#666",
              }}
            >
              Mark read
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
              color: "#ef4444",
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#0a0a0a",
          marginBottom: 8,
        }}
      >
        No notifications yet
      </h3>
      <p
        style={{
          fontSize: 14,
          color: "#666",
          maxWidth: 280,
          margin: "0 auto 24px",
          lineHeight: 1.5,
        }}
      >
        When you back campaigns, create style briefs, or place orders, you&apos;ll see updates here.
      </p>
      <Link
        href="/explore"
        style={{
          display: "inline-block",
          background: "#0a0a0a",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Explore Campaigns
      </Link>
    </div>
  );
}

function AuthGate() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#0a0a0a",
          marginBottom: 8,
        }}
      >
        Sign in to see notifications
      </h3>
      <p
        style={{
          fontSize: 14,
          color: "#666",
          maxWidth: 280,
          margin: "0 auto 24px",
          lineHeight: 1.5,
        }}
      >
        Create an account to track your backings, briefs, and orders.
      </p>
      <Link
        href="/auth/login"
        style={{
          display: "inline-block",
          background: "#0a0a0a",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Sign In
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Check auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("loocbooc_token");
    setToken(storedToken);
  }, []);

  // Fetch notifications
  const loadNotifications = useCallback(async (reset = true) => {
    if (!token) return;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const offset = reset ? 0 : notifications.length;
      const result = await fetchNotifications(token, {
        limit: 20,
        offset,
        unreadOnly: filter === "unread",
      });

      if (reset) {
        setNotifications(result.notifications);
      } else {
        setNotifications((prev) => [...prev, ...result.notifications]);
      }
      setUnreadCount(result.unreadCount);
      setHasMore(result.hasMore);
      setError(null);
    } catch (err) {
      setError("Failed to load notifications");
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, filter, notifications.length]);

  // Initial load
  useEffect(() => {
    if (token) {
      loadNotifications(true);
    } else {
      setLoading(false);
    }
  }, [token, filter]);

  // Mark as read
  const handleRead = async (id: string) => {
    if (!token) return;
    try {
      await markAsRead(token, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (!token || unreadCount === 0) return;
    try {
      await markAllAsRead(token);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deleteNotification(token, id);
      const deleted = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  // Load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadNotifications(false);
    }
  };

  // Group notifications for display
  const groups = groupNotifications(notifications);

  // Not logged in
  if (token === null && !loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#fff" }}>
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f0f0f0",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 10,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Notifications</h1>
        </header>
        <AuthGate />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Header */}
      <header
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f0f0f0",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Notifications</h1>
            {unreadCount > 0 && (
              <span
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                background: "none",
                border: "none",
                color: "#3b82f6",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? "#0a0a0a" : "#f5f5f5",
                color: filter === f ? "#fff" : "#666",
                border: "none",
                padding: "6px 14px",
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {f === "all" ? "All" : "Unread"}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: 20 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#ef4444",
            }}
          >
            <p style={{ marginBottom: 16 }}>{error}</p>
            <button
              onClick={() => loadNotifications(true)}
              style={{
                background: "#0a0a0a",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Try Again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.label} style={{ marginBottom: 24 }}>
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#999",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 12,
                  }}
                >
                  {group.label}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {group.items.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onRead={handleRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: "center", paddingTop: 16 }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    background: "#f5f5f5",
                    color: "#666",
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "none",
                    cursor: loadingMore ? "default" : "pointer",
                    fontSize: 14,
                    opacity: loadingMore ? 0.6 : 1,
                  }}
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
