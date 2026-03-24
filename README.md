# Loocbooc

**Virtual Try-On Platform for Fashion**

Create your avatar once. See how ANY garment looks on YOUR body. Works everywhere.

## Project Structure

```
loocbooc/
├── api/                    # Backend API (Node.js + Fastify)
│   └── src/
│       ├── routes/         # API endpoints
│       │   ├── auth.js     # Authentication (Shopify OAuth + Loocbooc accounts)
│       │   ├── avatar.js   # Avatar CRUD
│       │   ├── garment.js  # Garment sync and 3D generation
│       │   └── tryon.js    # Try-on rendering
│       └── services/       # Business logic
│           ├── supabase.js # Database client
│           ├── avatar-ai.js    # Body estimation AI
│           ├── garment-ai.js   # Garment to 3D AI
│           └── tryon-renderer.js # Render composition
│
├── web/                    # Frontend (React + Three.js)
│   └── src/
│       └── components/
│           ├── TryOnViewer.jsx     # 3D viewer
│           ├── TryOnModal.jsx      # Main modal
│           ├── AvatarCreator.jsx   # Avatar creation flow
│           └── ComparisonView.jsx  # Model vs avatar comparison
│
├── extensions/             # Shopify integrations
│   └── theme-extension/
│       ├── blocks/         # Theme blocks
│       └── assets/         # Embed scripts
│
├── supabase/              # Database
│   └── schema.sql         # PostgreSQL schema
│
├── .env.local             # Credentials (git-ignored)
├── MVP-SPEC.md            # Product specification
└── README.md              # This file
```

## Quick Start

### Prerequisites
- Node.js 20+
- Supabase account
- Shopify Partner account

### Setup

1. **Install dependencies**
```bash
cd api && npm install
cd ../web && npm install
```

2. **Configure environment**
```bash
# Copy .env.local and fill in values
cp .env.example .env.local
```

3. **Set up database**
- Create a Supabase project
- Run `supabase/schema.sql` in SQL editor
- Add Supabase URL and key to `.env.local`

4. **Run development**
```bash
# Terminal 1: API
cd api && npm run dev

# Terminal 2: Web
cd web && npm run dev
```

## MVP Scope

### Avatar Creation
- ✅ Manual measurements input
- ⏳ Photo upload → AI estimation
- ⏳ Guided body scan (future)

### Try-On Experience
- ✅ 3D viewer (React Three Fiber)
- ✅ Side-by-side comparison (model vs avatar)
- ⏳ Fit analysis and recommendations

### Integration
- ✅ Shopify theme extension
- ✅ Product page button
- ⏳ Virtual Fitting Room page

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Fastify |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| 3D Rendering | React Three Fiber |
| Shopify Integration | App Bridge + Theme Extensions |

## API Endpoints

### Auth
- `GET /api/auth/shopify` - Start OAuth
- `GET /api/auth/shopify/callback` - OAuth callback
- `POST /api/auth/signup` - Create Loocbooc account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user

### Avatar
- `GET /api/avatar` - Get user's avatar
- `POST /api/avatar/measurements` - Create from measurements
- `POST /api/avatar/photos` - Create from photos
- `PATCH /api/avatar` - Update avatar
- `DELETE /api/avatar` - Delete avatar

### Garment
- `GET /api/garment/:id` - Get garment
- `GET /api/garment` - List garments
- `POST /api/garment/sync` - Sync from Shopify
- `PATCH /api/garment/:id/tryon` - Enable/disable try-on

### Try-On
- `POST /api/tryon/render` - Generate try-on
- `GET /api/tryon/render/:avatarId/:garmentId` - Get cached render
- `GET /api/tryon/compare/:garmentId` - Get comparison data
- `GET /api/tryon/fit/:avatarId/:garmentId` - Get fit recommendation

## Deployment

### API
Deploy to Railway, Render, or similar Node.js host.

### Web
Build and deploy to CDN (Vercel, Cloudflare Pages).

### Shopify App
Submit theme extension through Shopify Partners.

## Next Steps

1. [ ] Set up Supabase project
2. [ ] Implement Shopify OAuth flow
3. [ ] Integrate body estimation API
4. [ ] Integrate garment-to-3D API
5. [ ] Build production 3D models
6. [ ] Deploy and test on dev store
7. [ ] Install on Charcoal production

---

Built for Charcoal Clothing. Vision: Universal standard for fashion industry.
