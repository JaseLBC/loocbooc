/**
 * Stripe client singleton.
 * Used for payment intents, charges, and refunds throughout the API.
 */

import Stripe from "stripe";

const stripeSecretKey = process.env["STRIPE_SECRET_KEY"];
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required.");
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  typescript: true,
});

export default stripe;
