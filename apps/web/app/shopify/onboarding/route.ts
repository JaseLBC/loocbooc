/**
 * Loader and action for the brand onboarding route.
 *
 * Loader: fetch shop info from Shopify Admin API; check for existing Brand.
 * Action: create Brand record in Loocbooc via the core API.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../app.server";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Authenticates the Shopify session and returns shop metadata.
 * Also checks whether a Brand record already exists for this store.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch shop details from Shopify GraphQL Admin API.
  const response = await admin.graphql(`
    query {
      shop {
        name
        myshopifyDomain
        primaryDomain { url }
        currencyCode
      }
    }
  `);

  const data = await response.json() as {
    data: {
      shop: {
        name: string;
        myshopifyDomain: string;
        currencyCode: string;
      };
    };
  };

  const shopData = data.data.shop;

  // Check for existing Brand in Loocbooc API.
  let existingBrandId: string | null = null;
  try {
    const apiUrl = process.env.LOOCBOOC_API_URL;
    const apiRes = await fetch(
      `${apiUrl}/api/v1/brands/by-shopify?shopUrl=${encodeURIComponent(session.shop)}`,
      {
        headers: { "X-Internal-Secret": process.env.INTERNAL_WEBHOOK_SECRET ?? "" },
      }
    );
    if (apiRes.ok) {
      const brand = await apiRes.json() as { id: string };
      existingBrandId = brand.id;
    }
  } catch {
    // Brand lookup failure is non-fatal — onboarding handles the case
    existingBrandId = null;
  }

  return json({
    shop: session.shop,
    shopName: shopData.name,
    existingBrandId,
  });
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Handles the form submission from the onboarding wizard.
 * Creates a Brand record in the Loocbooc API and stores the Shopify
 * session association.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const brandName = formData.get("brandName") as string;
  const brandSlug = formData.get("brandSlug") as string;
  const currency = formData.get("currency") as string;
  const depositPercent = Number(formData.get("depositPercent") ?? 100);
  const defaultMoq = Number(formData.get("defaultMoq") ?? 50);

  if (!brandName || !brandSlug) {
    return json({ success: false, error: "Brand name and slug are required." });
  }

  const apiUrl = process.env.LOOCBOOC_API_URL;

  try {
    const res = await fetch(`${apiUrl}/api/v1/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify({
        name: brandName,
        slug: brandSlug,
        currency,
        shopifyStoreUrl: `https://${session.shop}`,
        settings: {
          backIt: {
            depositPercent,
            defaultMoq,
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      return json({
        success: false,
        error: err.error?.message ?? "Failed to create brand.",
      });
    }

    const brand = await res.json() as { id: string };
    return json({ success: true, brandId: brand.id });
  } catch (err) {
    console.error("[onboarding] Brand creation failed:", err);
    return json({ success: false, error: "An unexpected error occurred." });
  }
};
