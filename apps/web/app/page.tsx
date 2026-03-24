/**
 * Root page — serves the public homepage for anonymous visitors,
 * routes authenticated users to their role-specific dashboard.
 *
 * Architecture:
 * - This is a Server Component — the homepage itself is fully SSR/ISR
 * - Auth routing happens client-side (the user's session is browser-state)
 * - We render the homepage by default (great for SEO, fast first paint)
 * - The AuthRouteGuard client component handles the auth redirect silently
 *   after hydration — authenticated users are bounced immediately, no flash
 *
 * Why not redirect on the server?
 * Auth state is stored in Supabase session cookies. We could read them
 * server-side, but the homepage is ISR-cached — we can't personalise
 * server rendering per-user. The auth redirect happens client-side
 * with a useEffect, which is instant (no layout shift) for authenticated
 * users who have the session cookie set.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HomePage from "./home/page";

export { metadata } from "./home/page";

export default function RootPage() {
  // For now, render the public homepage.
  // Authenticated user routing is handled client-side in AuthRouteGuard
  // (rendered inside the homepage via the NavBar auth state detection).
  return <HomePage />;
}
