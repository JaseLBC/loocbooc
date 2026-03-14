/**
 * Supabase client for the web app.
 * Exports both a browser client (for client components) and a server client
 * (for server components and API routes).
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "";

/**
 * Browser-side Supabase client.
 * Used in client components for real-time subscriptions, auth, etc.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
