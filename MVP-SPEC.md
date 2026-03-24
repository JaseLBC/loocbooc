# Loocbooc MVP Specification
*Locked: March 24, 2026 — 9:11 PM AEST*

---

## Core Promise
"Create your avatar once. See how ANY garment looks on YOUR body. Works everywhere."

---

## MVP Scope

### User
Charcoal customer on charcoalclothing.com

### Avatar Creation
- **Basic:** Manual measurements (always available)
- **Better:** Manual + Photo upload (2 photos → AI estimates)
- Guide users toward photo for best accuracy

### Try-On Experience
- 3D viewer — Rotate avatar, see all angles
- Comparison — Side-by-side: model photo vs their avatar

### Garment Data
- AI from photos — Upload product photos → AI generates 3D
- Future: 3D baked into manufacturing (UUID per garment)

### Plugin Placement
- Product page button → opens modal
- Dedicated "Virtual Fitting Room" nav page
- Full site integration

### Account
- Loocbooc account from day one
- Even on Charcoal's site, builds Loocbooc user base
- Portable across all future brand integrations

---

## Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| Shopify Plugin | React + Polaris | Native Shopify, easy to hire |
| 3D Rendering | React Three Fiber (Three.js) | Industry standard, mobile-ready |
| Backend API | Node.js + Fastify | Fast, native Shopify SDK |
| Database | Supabase (PostgreSQL) | Auth + DB + Storage combined |
| Avatar AI | API-first (Meshcapade/Avaturn) | Don't rebuild ML |
| Garment AI | API-first (TBD) | Photos → 3D garment |
| Mobile (future) | Flutter | API-first backend supports this |

---

## Architecture

```
CUSTOMER ON CHARCOAL.COM
         │
         ▼
┌─────────────────────────┐
│  Shopify App Embed      │
│  (React + Three.js)     │
│  - Try-on modal         │
│  - 3D viewer            │
│  - Avatar creation      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Loocbooc API           │
│  (Node.js + Fastify)    │
│  - Auth                 │
│  - Avatar CRUD          │
│  - Garment sync         │
│  - Try-on rendering     │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌─────────┐  ┌──────────┐
│Supabase │  │ AI APIs  │
│- Users  │  │- Body    │
│- Avatars│  │- Garment │
│- Assets │  │          │
└─────────┘  └──────────┘
```

---

## Credentials

- **Shopify Partner:** jason@loocbooc.com
- **App Client ID:** 01888f8d611cefb317fc6ceb62033d54
- **Dev Store:** loocbooc-dev.myshopify.com

---

## Build Order

1. ✅ Shopify Partner + App + Dev Store
2. ✅ Project scaffold
3. ✅ Backend API skeleton (auth, avatar, garment, tryon routes)
4. ✅ Database schema (Supabase SQL)
5. ✅ 3D viewer component (TryOnViewer.jsx)
6. ✅ Avatar creator component (AvatarCreator.jsx)
7. ✅ Comparison view component (ComparisonView.jsx)
8. ✅ Try-on modal (TryOnModal.jsx)
9. ✅ Shopify theme extension (tryon-button.liquid)
10. ⏳ Supabase project setup (need to create)
11. ⏳ Shopify OAuth flow (needs testing)
12. ⏳ Photo upload → avatar AI (stub ready, needs real API)
13. ⏳ Garment → 3D AI (stub ready, needs real API)
14. ⏳ Deploy and test on dev store
15. ⏳ Virtual Fitting Room page
