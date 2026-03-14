/**
 * Shopify OAuth entry point.
 *
 * GET  /shopify/auth?shop=<store>.myshopify.com
 *   → Redirects to Shopify's OAuth consent screen.
 *
 * This route is automatically called:
 *   - When a merchant installs the app from the Shopify App Store
 *   - When an existing session has expired and needs re-authentication
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../app.server";

/**
 * Initiates the Shopify OAuth flow.
 * The `authenticate.admin` call performs the redirect to Shopify's auth page.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
