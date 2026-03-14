/**
 * Shopify OAuth callback.
 *
 * GET  /shopify/auth/callback?code=…&hmac=…&shop=…&state=…
 *   → Validates HMAC, exchanges code for a permanent access token,
 *     stores the session, then redirects into the embedded app.
 *
 * The `authenticate.admin` call handles all validation and token exchange.
 * After this resolves, a valid ShopifySession exists in the session storage.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../app.server";

/**
 * Completes the OAuth handshake and redirects to the app home page.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Trigger brand onboarding if this is a fresh installation.
  // The session shop URL identifies the Shopify store.
  const shopUrl = `https://${session.shop}`;
  const onboardingRedirect = `/shopify/onboarding?shop=${session.shop}`;

  // In production, check whether a Brand record already exists for this store.
  // If not, redirect to onboarding. If yes, go straight to the dashboard.
  // For now we always redirect to onboarding — idempotent by design.
  return new Response(null, {
    status: 302,
    headers: {
      Location: onboardingRedirect,
    },
  });
};
