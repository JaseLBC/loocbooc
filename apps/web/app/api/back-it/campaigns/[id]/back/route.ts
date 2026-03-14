/**
 * Next.js API route: POST /api/back-it/campaigns/:id/back
 * Proxies the backing request to the Fastify API with the user's auth token.
 * This keeps the Stripe PaymentMethod ID and auth token server-side.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // Get the user's auth token from Supabase session
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
      { error: { code: "UNAUTHORIZED", message: "You must be logged in to back a campaign." } },
      { status: 401 },
    );
  }

  const body: unknown = await request.json();

  // Forward to the Fastify API with the user's JWT
  const response = await fetch(
    `${API_URL}/api/v1/back-it/campaigns/${params.id}/back`,
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
