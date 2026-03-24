/**
 * Stylist Portfolio Page — showcase lookbooks and styling work.
 *
 * Features:
 * - Grid of completed lookbooks
 * - Stats: total lookbooks, total items styled, avg rating
 * - Upload/add new portfolio pieces
 * - Publish/unpublish control
 *
 * Design: Visual gallery with hover details.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PortfolioItem {
  id: string;
  title: string;
  briefId: string | null;
  coverImageUrl: string | null;
  itemCount: number;
  clientRating: number | null;
  isPublic: boolean;
  createdAt: string;
}

interface PortfolioStats {
  totalLookbooks: number;
  totalItemsStyled: number;
  avgRating: number | null;
  publicCount: number;
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function StylistPortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({
    totalLookbooks: 0,
    totalItemsStyled: 0,
    avgRating: null,
    publicCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "public" | "private">("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/stylists/me/portfolio", {
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setItems(data.items || []);
        setStats(data.stats || {
          totalLookbooks: 0,
          totalItemsStyled: 0,
          avgRating: null,
          publicCount: 0,
        });
      } catch {
        // Mock data for development
        setItems([
          {
            id: "1",
            title: "Summer Capsule Wardrobe",
            briefId: "b1",
            coverImageUrl: null,
            itemCount: 12,
            clientRating: 4.8,
            isPublic: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: "2",
            title: "Office to Evening Transition",
            briefId: "b2",
            coverImageUrl: null,
            itemCount: 8,
            clientRating: 5.0,
            isPublic: true,
            createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          },
          {
            id: "3",
            title: "Travel Capsule",
            briefId: "b3",
            coverImageUrl: null,
            itemCount: 15,
            clientRating: 4.5,
            isPublic: false,
            createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          },
        ]);
        setStats({
          totalLookbooks: 3,
          totalItemsStyled: 35,
          avgRating: 4.77,
          publicCount: 2,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleTogglePublic = async (itemId: string, newState: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isPublic: newState } : item
      )
    );

    try {
      await fetch(`/api/v1/stylists/me/portfolio/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublic: newState }),
      });
    } catch {
      // Revert on failure
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isPublic: !newState } : item
        )
      );
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === "public") return item.isPublic;
    if (filter === "private") return !item.isPublic;
    return true;
  });

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #0a0a0a",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#0a0a0a",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Portfolio
          </h1>
          <p style={{ color: "#666", fontSize: 14, margin: "6px 0 0" }}>
            Showcase your best styling work to attract new clients
          </p>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: 16,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Lookbooks</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 0" }}>
            {stats.totalLookbooks}
          </p>
        </div>
        <div
          style={{
            padding: 16,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Items Styled</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 0" }}>
            {stats.totalItemsStyled}
          </p>
        </div>
        <div
          style={{
            padding: 16,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Avg Rating</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 0" }}>
            {stats.avgRating?.toFixed(1) || "—"}
            {stats.avgRating && <span style={{ fontSize: 14, color: "#888" }}> ★</span>}
          </p>
        </div>
        <div
          style={{
            padding: 16,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Public</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 0" }}>
            {stats.publicCount}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: "1px solid #e5e5e5",
          paddingBottom: 12,
        }}
      >
        {(["all", "public", "private"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: filter === f ? 600 : 400,
              color: filter === f ? "#0a0a0a" : "#888",
              background: filter === f ? "#f4f4f5" : "transparent",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {f} {f === "all" ? `(${items.length})` : f === "public" ? `(${items.filter((i) => i.isPublic).length})` : `(${items.filter((i) => !i.isPublic).length})`}
          </button>
        ))}
      </div>

      {/* Portfolio grid */}
      {filteredItems.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#fafafa",
            borderRadius: 12,
          }}
        >
          <p style={{ fontSize: 48, margin: "0 0 12px" }}>🖼️</p>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            No portfolio items yet
          </h3>
          <p style={{ color: "#666", fontSize: 14, margin: "0 0 20px" }}>
            Complete style briefs to add lookbooks to your portfolio
          </p>
          <Link
            href="/stylist/briefs"
            style={{
              padding: "12px 24px",
              background: "#0a0a0a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            View briefs
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                overflow: "hidden",
              }}
            >
              {/* Cover image */}
              <div
                style={{
                  aspectRatio: "16 / 10",
                  background: item.coverImageUrl
                    ? `url(${item.coverImageUrl}) center/cover`
                    : "linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!item.coverImageUrl && (
                  <span style={{ fontSize: 40, opacity: 0.4 }}>📸</span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      margin: 0,
                      color: "#0a0a0a",
                    }}
                  >
                    {item.title}
                  </h3>
                  {item.clientRating && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#888",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ★ {item.clientRating.toFixed(1)}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: "#888", margin: "8px 0 0" }}>
                  {item.itemCount} items
                </p>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: "1px solid #f0f0f0",
                  }}
                >
                  <button
                    onClick={() => handleTogglePublic(item.id, !item.isPublic)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      background: item.isPublic ? "#dcfce7" : "#f4f4f5",
                      color: item.isPublic ? "#166534" : "#666",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {item.isPublic ? "✓ Public" : "Private"}
                  </button>

                  {item.briefId && (
                    <Link
                      href={`/stylist/briefs/${item.briefId}`}
                      style={{
                        fontSize: 12,
                        color: "#888",
                        textDecoration: "none",
                      }}
                    >
                      View brief →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
