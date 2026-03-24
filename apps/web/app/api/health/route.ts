/**
 * Health check endpoint for the Next.js web app.
 * Used by Docker health checks and load balancers.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "web",
    timestamp: new Date().toISOString(),
  });
}
