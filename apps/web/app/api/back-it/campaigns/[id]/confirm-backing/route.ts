/**
 * Next.js API route — POST /api/back-it/campaigns/:id/confirm-backing
 *
 * Step 2 of the 2-step Stripe backing flow.
 * Called by the success page after Stripe redirects back with a confirmed
 * PaymentIntent. Proxies to Fastify to create the backing record in the DB.
 *
 * Auth: Supabase session cookie.
 * Idempotent: safe to call multiple times for the same paymentIntentId
 * (page refreshes on the success page will not double-count).
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "",
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "",
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "You must be logged in to confirm a backing." } },
      { status: 401 },
    );
  }

  const body: unknown = await request.json();

  const response = await fetch(
    `${API_URL}/api/v1/back-it/campaigns/${params.id}/confirm-backing`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    },
  );

  const data: unknown = await response.json();
  return NextResponse.json(data, { status: response.status });
}
