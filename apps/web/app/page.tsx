/**
 * Root home page — redirects based on auth state.
 * Authenticated users land on their dashboard based on role.
 * Unauthenticated users see the marketing/browse page.
 */

import { redirect } from "next/navigation";

export default function HomePage() {
  // TODO: Check auth and redirect to correct dashboard
  // For now, redirect to consumer browse
  redirect("/explore");
}
