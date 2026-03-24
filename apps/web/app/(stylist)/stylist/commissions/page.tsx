/**
 * Stylist Commissions/Earnings Page — track income from completed briefs.
 *
 * Features:
 * - Total earnings summary (lifetime, this month, pending)
 * - Earnings by brief
 * - Payout history
 * - Bank account / Stripe Connect setup
 *
 * Design: Financial dashboard with clean data tables.
 */

"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface EarningsSummary {
  lifetimeEarnings: number;
  thisMonthEarnings: number;
  pendingEarnings: number;
  availableForPayout: number;
  currency: string;
}

interface Commission {
  id: string;
  briefId: string;
  briefTitle: string;
  clientName: string;
  amount: number;
  currency: string;
  status: "pending" | "available" | "paid";
  earnedAt: string;
  paidAt: string | null;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: "processing" | "paid" | "failed";
  initiatedAt: string;
  completedAt: string | null;
  bankLast4: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCurrency(cents: number, currency: string = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function StylistCommissionsPage() {
  const [summary, setSummary] = useState<EarningsSummary>({
    lifetimeEarnings: 0,
    thisMonthEarnings: 0,
    pendingEarnings: 0,
    availableForPayout: 0,
    currency: "AUD",
  });
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"commissions" | "payouts">("commissions");
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/stylists/me/earnings", {
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSummary(data.summary);
        setCommissions(data.commissions || []);
        setPayouts(data.payouts || []);
        setStripeConnected(data.stripeConnected || false);
      } catch {
        // Mock data for development
        setSummary({
          lifetimeEarnings: 245000, // $2,450
          thisMonthEarnings: 85000, // $850
          pendingEarnings: 35000, // $350
          availableForPayout: 50000, // $500
          currency: "AUD",
        });
        setCommissions([
          {
            id: "c1",
            briefId: "b1",
            briefTitle: "Summer Capsule Wardrobe",
            clientName: "Emily S.",
            amount: 15000,
            currency: "AUD",
            status: "paid",
            earnedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
            paidAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          },
          {
            id: "c2",
            briefId: "b2",
            briefTitle: "Office to Evening",
            clientName: "Sarah M.",
            amount: 20000,
            currency: "AUD",
            status: "available",
            earnedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
            paidAt: null,
          },
          {
            id: "c3",
            briefId: "b3",
            briefTitle: "Travel Wardrobe",
            clientName: "Jen K.",
            amount: 35000,
            currency: "AUD",
            status: "pending",
            earnedAt: new Date().toISOString(),
            paidAt: null,
          },
        ]);
        setPayouts([
          {
            id: "p1",
            amount: 75000,
            currency: "AUD",
            status: "paid",
            initiatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
            completedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
            bankLast4: "4242",
          },
        ]);
        setStripeConnected(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRequestPayout = async () => {
    if (summary.availableForPayout <= 0) return;
    setRequestingPayout(true);

    try {
      const res = await fetch("/api/v1/stylists/me/payouts", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh data
        window.location.reload();
      }
    } catch {
      // Handle error
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleConnectStripe = () => {
    // In production, this would redirect to Stripe Connect onboarding
    window.location.href = "/api/v1/stylists/me/stripe/connect";
  };

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
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#0a0a0a",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Earnings
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: "6px 0 0" }}>
          Track your commissions and request payouts
        </p>
      </div>

      {/* Stripe Connect banner */}
      {!stripeConnected && (
        <div
          style={{
            padding: 20,
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: 12,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#92400e" }}>
              ⚠️ Connect your bank account
            </p>
            <p style={{ fontSize: 13, color: "#a16207", margin: "4px 0 0" }}>
              Set up Stripe to receive payouts for your styling work
            </p>
          </div>
          <button
            onClick={handleConnectStripe}
            style={{
              padding: "10px 20px",
              background: "#0a0a0a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Connect bank account
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: 20,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Lifetime Earnings</p>
          <p style={{ fontSize: 32, fontWeight: 700, margin: "4px 0 0" }}>
            {formatCurrency(summary.lifetimeEarnings, summary.currency)}
          </p>
        </div>
        <div
          style={{
            padding: 20,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>This Month</p>
          <p style={{ fontSize: 32, fontWeight: 700, margin: "4px 0 0" }}>
            {formatCurrency(summary.thisMonthEarnings, summary.currency)}
          </p>
        </div>
        <div
          style={{
            padding: 20,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Pending</p>
          <p style={{ fontSize: 32, fontWeight: 700, margin: "4px 0 0", color: "#f59e0b" }}>
            {formatCurrency(summary.pendingEarnings, summary.currency)}
          </p>
          <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
            Available after client accepts lookbook
          </p>
        </div>
        <div
          style={{
            padding: 20,
            background: summary.availableForPayout > 0 ? "#dcfce7" : "#fff",
            borderRadius: 12,
            border: `1px solid ${summary.availableForPayout > 0 ? "#22c55e" : "#e5e5e5"}`,
          }}
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Available for Payout</p>
          <p
            style={{
              fontSize: 32,
              fontWeight: 700,
              margin: "4px 0 0",
              color: summary.availableForPayout > 0 ? "#16a34a" : "#0a0a0a",
            }}
          >
            {formatCurrency(summary.availableForPayout, summary.currency)}
          </p>
          {summary.availableForPayout > 0 && stripeConnected && (
            <button
              onClick={handleRequestPayout}
              disabled={requestingPayout}
              style={{
                marginTop: 12,
                padding: "8px 16px",
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: requestingPayout ? "wait" : "pointer",
                opacity: requestingPayout ? 0.6 : 1,
              }}
            >
              {requestingPayout ? "Requesting..." : "Request payout"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid #e5e5e5",
          paddingBottom: 12,
        }}
      >
        <button
          onClick={() => setTab("commissions")}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: tab === "commissions" ? 600 : 400,
            color: tab === "commissions" ? "#0a0a0a" : "#888",
            background: tab === "commissions" ? "#f4f4f5" : "transparent",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Commissions ({commissions.length})
        </button>
        <button
          onClick={() => setTab("payouts")}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: tab === "payouts" ? 600 : 400,
            color: tab === "payouts" ? "#0a0a0a" : "#888",
            background: tab === "payouts" ? "#f4f4f5" : "transparent",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Payouts ({payouts.length})
        </button>
      </div>

      {/* Commissions table */}
      {tab === "commissions" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            overflow: "hidden",
          }}
        >
          {commissions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <p style={{ fontSize: 40, margin: "0 0 12px" }}>💰</p>
              <p style={{ fontSize: 14, color: "#888" }}>
                No commissions yet. Complete briefs to start earning.
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Brief
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Client
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 500 }}>
                      {c.briefTitle}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, color: "#666" }}>
                      {c.clientName}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(c.amount, c.currency)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            c.status === "paid"
                              ? "#dcfce7"
                              : c.status === "available"
                              ? "#dbeafe"
                              : "#fef3c7",
                          color:
                            c.status === "paid"
                              ? "#166534"
                              : c.status === "available"
                              ? "#1d4ed8"
                              : "#92400e",
                        }}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: 13,
                        color: "#888",
                        textAlign: "right",
                      }}
                    >
                      {formatDate(c.earnedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payouts table */}
      {tab === "payouts" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            overflow: "hidden",
          }}
        >
          {payouts.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <p style={{ fontSize: 40, margin: "0 0 12px" }}>🏦</p>
              <p style={{ fontSize: 14, color: "#888" }}>
                No payouts yet. Request a payout when you have available funds.
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Bank Account
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Initiated
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600 }}>
                      {formatCurrency(p.amount, p.currency)}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, color: "#666" }}>
                      •••• {p.bankLast4}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            p.status === "paid"
                              ? "#dcfce7"
                              : p.status === "processing"
                              ? "#dbeafe"
                              : "#fee2e2",
                          color:
                            p.status === "paid"
                              ? "#166534"
                              : p.status === "processing"
                              ? "#1d4ed8"
                              : "#dc2626",
                        }}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: 13,
                        color: "#888",
                        textAlign: "right",
                      }}
                    >
                      {formatDate(p.initiatedAt)}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: 13,
                        color: "#888",
                        textAlign: "right",
                      }}
                    >
                      {p.completedAt ? formatDate(p.completedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
