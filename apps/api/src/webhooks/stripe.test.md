# Stripe Webhook Integration Tests

## How to test locally (Stripe CLI)

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward events to local server:
   ```
   stripe listen --forward-to localhost:3001/webhooks/stripe
   ```
4. Copy the webhook signing secret output (starts with `whsec_`)
   and set `STRIPE_WEBHOOK_SECRET=whsec_...` in your `apps/api/.env`

## Test event sequences

### Happy path — backing via client redirect
```
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata.campaignId=<id> \
  --override payment_intent:metadata.userId=<id> \
  --override payment_intent:metadata.size=M \
  --override payment_intent:metadata.quantity=1
```
Expected: backing created in DB (if not already) + confirmation email queued

### Client browser close — webhook-only backing confirmation
Create a PaymentIntent via the API, confirm it in Stripe directly without
hitting the client success page. The webhook should create the backing.

### Payment failure
```
stripe trigger payment_intent.payment_failed
```
Expected: if backing exists for that PI, depositStatus updated to "failed"

### Manual refund
```
stripe trigger charge.refunded
```
Expected: backing status updated to "refunded" + refund email queued

### Chargeback
```
stripe trigger charge.dispute.created
```
Expected:
  - campaign_events record created
  - admin alert email sent immediately
  - Log: "DISPUTE CREATED — admin action required"

## Key env vars required
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (from `stripe listen` output or Stripe Dashboard)
- `ADMIN_ALERT_EMAIL` (for dispute alerts)
- `WEB_APP_URL` (for email CTA links)
