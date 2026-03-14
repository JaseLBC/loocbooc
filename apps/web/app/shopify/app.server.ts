/**
 * Shopify App Server — initialises @shopify/shopify-app-remix with
 * database-backed session storage and the required OAuth scopes.
 *
 * Import `shopify` from this module anywhere in the embedded app that
 * needs to authenticate Shopify requests (loaders, actions, webhooks).
 */

import "@shopify/shopify-app-remix/adapters/node";
import {
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Singleton Shopify app instance.
 * Handles OAuth, session storage, and App Bridge token verification.
 */
export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: "2024-01",
  scopes: (process.env.SHOPIFY_SCOPES ?? "write_orders,read_products,write_draft_orders").split(","),
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/shopify",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  webhooks: {
    /**
     * orders/paid — confirm backing deposit; trigger MOQ check.
     */
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/shopify/webhooks",
    },
    /**
     * orders/cancelled — trigger refund flow for linked backing.
     */
    ORDERS_CANCELLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/shopify/webhooks",
    },
    /**
     * app/uninstalled — revoke tokens, mark integration inactive.
     */
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/shopify/webhooks",
    },
    /**
     * GDPR — shop data erasure request (required for App Store approval).
     */
    SHOP_REDACT: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/shopify/webhooks",
    },
    /**
     * GDPR — customer data erasure request.
     */
    CUSTOMERS_REDACT: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/shopify/webhooks",
    },
    /**
     * GDPR — customer data access request.
     */
    CUSTOMERS_DATA_REQUEST: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/shopify/webhooks",
    },
  },
  hooks: {
    /**
     * Called after OAuth completes for a new installation.
     * Registers all webhooks declared above.
     */
    afterAuth: async ({ admin, session }) => {
      shopify.registerWebhooks({ session });
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
});

export default shopify;
export const apiVersion = "2024-01";
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
