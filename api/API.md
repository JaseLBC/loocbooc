# Loocbooc API Documentation

Base URL: `https://api.loocbooc.com` (production) or `http://localhost:3000` (local)

## Health

### GET /health
Check API status.

```json
Response:
{
  "status": "ok",
  "timestamp": "2026-03-24T12:00:00.000Z"
}
```

---

## Avatar

### GET /api/avatar
Get the current user's avatar.

### POST /api/avatar/measurements
Create avatar from measurements.

```json
Request:
{
  "height": 165,
  "bust": 90,
  "waist": 70,
  "hips": 95,
  "bodyType": "hourglass"
}

Response:
{
  "avatar": {
    "id": "avatar-123",
    "measurements": { ... },
    "model_url": "...",
    "model_data": { ... }
  }
}
```

### POST /api/avatar/photos
Create avatar from photos (AI estimation).

```json
Request:
{
  "frontPhoto": "data:image/jpeg;base64,...",
  "sidePhoto": "data:image/jpeg;base64,..."
}
```

### POST /api/avatar/body-type
Analyze body type from measurements.

```json
Request:
{
  "bust": 90,
  "waist": 68,
  "hips": 96
}

Response:
{
  "bodyType": "pear",
  "confidence": 0.9,
  "description": "Hips wider than bust with a defined waist",
  "flattering": ["A-line skirts", "Wide-leg pants", ...],
  "avoid": ["Skinny jeans without longer top", ...],
  "ratios": { "bustHipRatio": 0.94, ... }
}
```

### PATCH /api/avatar
Update avatar measurements.

### DELETE /api/avatar
Delete avatar.

---

## Try-On

### POST /api/tryon/render
Generate try-on visualization.

```json
Request:
{
  "avatarId": "avatar-123",
  "garmentId": "garment-456",
  "size": "M",
  "color": "#2d2519"
}

Response:
{
  "render": {
    "url": "...",
    "data": { ... },
    "fitAnalysis": {
      "overall": 0.85,
      "areas": { "bust": {...}, "waist": {...}, "hips": {...} },
      "recommendation": { "size": "M", "confidence": 0.85, "message": "..." }
    }
  }
}
```

### POST /api/tryon/size-check
Quick size recommendation without stored avatar.

```json
Request:
{
  "bust": 88,
  "waist": 68,
  "hips": 94,
  "region": "AU",
  "sizeChart": { ... }
}

Response:
{
  "recommended": {
    "size": "8",
    "confidence": 86,
    "fit": { "label": "Great fit", "emoji": "👍" },
    "details": { ... }
  },
  "allSizes": [ ... ]
}
```

### GET /api/tryon/fit/:avatarId/:garmentId
Get fit recommendation for avatar + garment.

---

## Garment

### GET /api/garment/:id
Get garment details.

### GET /api/garment
List garments for a shop.

### POST /api/garment/sync
Sync garments from Shopify.

### PATCH /api/garment/:id/tryon
Enable/disable try-on for garment.

---

## Analytics

### POST /api/analytics/track
Track an event.

```json
Request:
{
  "eventType": "tryon_button_click",
  "shop": "store.myshopify.com",
  "garmentId": "product-123",
  "metadata": { ... }
}
```

Event types:
- `tryon_button_click`
- `tryon_modal_open` / `tryon_modal_close`
- `avatar_create_start` / `avatar_create_complete`
- `tryon_size_select` / `tryon_color_select`
- `add_to_cart` / `add_to_cart_from_tryon`
- `purchase` / `purchase_with_tryon`
- `return_initiated` / `return_reason_size` / `return_reason_fit`

### GET /api/analytics/shop/:shop
Get shop analytics.

### GET /api/analytics/shop/:shop/conversion
Get conversion metrics.

### GET /api/analytics/events
List available event types.

---

## Merchant

### POST /api/merchant/roi
Calculate ROI for implementing Loocbooc.

```json
Request:
{
  "monthlyOrders": 2000,
  "averageOrderValue": 150,
  "currentReturnRate": 0.35,
  "returnProcessingCost": 15
}

Response:
{
  "roi": {
    "current": { "monthlyReturns": 700, "returnRate": "35%", ... },
    "withLoocbooc": { "monthlyReturns": 340, "returnRate": "17%", ... },
    "savings": { "annualSavings": 129600, "totalAnnualBenefit": 264600 },
    "roi": { "monthlyFee": 500, "monthlyROI": "4410%", "paybackMonths": "Immediate" }
  }
}
```

### POST /api/merchant/return-risk
Predict return risk for a purchase.

```json
Request:
{
  "bust": 92,
  "waist": 70,
  "hips": 96,
  "selectedSize": "S",
  "garmentType": "dress"
}

Response:
{
  "returnRisk": 0.1,
  "returnRiskPercent": "10%",
  "likelyReason": "unlikely",
  "fitScore": 0.88,
  "recommendation": { "level": "medium", "message": "...", "action": "review_size_guide" }
}
```

### GET /api/merchant/dashboard/:shop
Get full dashboard data for a shop.

---

## Waitlist

### POST /api/waitlist/join
Join the waitlist.

```json
Request:
{
  "email": "brand@example.com",
  "type": "brand",
  "company": "Fashion Co",
  "monthlyOrders": 1000
}
```

### GET /api/waitlist/stats
Get waitlist statistics (admin).

### GET /api/waitlist/export
Export waitlist entries (admin).

---

## Webhooks

### POST /webhooks/products/create
### POST /webhooks/products/update
### POST /webhooks/products/delete
Product lifecycle webhooks from Shopify.

### POST /webhooks/orders/create
Order created (for conversion tracking).

### POST /webhooks/app/uninstalled
App uninstalled from shop.

### POST /webhooks/customers/data_request
### POST /webhooks/customers/redact
### POST /webhooks/shop/redact
GDPR compliance webhooks.

---

## Embed

### GET /embed/tryon
Embedded try-on page for Shopify storefronts.

Query params:
- `product` - Shopify product ID
- `shop` - Shop domain

### GET /embed/loocbooc.js
Embed script for storefronts.

---

## Authentication

Most endpoints work in dev mode without authentication.

In production:
- Customer endpoints use Supabase Auth JWT
- Shopify endpoints use session tokens from OAuth
- Admin endpoints require API key

Add `Authorization: Bearer <token>` header for authenticated requests.
