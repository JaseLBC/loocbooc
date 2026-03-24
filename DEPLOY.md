# Loocbooc Deployment Guide

## Quick Start (5 minutes)

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `loocbooc-prod`
3. Region: `ap-southeast-2` (Sydney)
4. Copy the **Project URL** and **anon key** from Settings → API
5. Run the schema:
   - Go to SQL Editor
   - Paste contents of `supabase/schema.sql`
   - Click Run

### 2. Railway (API)

1. Go to [railway.app](https://railway.app) → New Project
2. Deploy from GitHub → Select `JaseLBC/loocbooc`
3. Set root directory: `api`
4. Add environment variables:
   ```
   SUPABASE_URL=<your-project-url>
   SUPABASE_ANON_KEY=<your-anon-key>
   SHOPIFY_API_KEY=01888f8d611cefb317fc6ceb62033d54
   SHOPIFY_API_SECRET=<from .env.local>
   SHOPIFY_APP_URL=https://<railway-domain>
   NODE_ENV=production
   ```
5. Railway will auto-deploy on push

### 3. Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import `JaseLBC/loocbooc`
3. Set root directory: `web`
4. Add environment variable:
   ```
   VITE_API_URL=https://<railway-api-url>
   ```
5. Deploy

### 4. Shopify App Setup

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Apps → Loocbooc → App setup
3. Update URLs:
   - App URL: `https://<vercel-domain>`
   - Allowed redirection URLs: `https://<railway-domain>/api/auth/shopify/callback`
4. Install on dev store: `loocbooc-dev.myshopify.com`

### 5. Theme Extension

1. In Shopify Partners → Loocbooc → Extensions
2. Create extension → Theme app extension
3. Upload files from `extensions/theme-extension/`
4. Deploy extension
5. In dev store theme editor, add "Loocbooc Try-On" block to product page

---

## Environment Variables Reference

### API (.env)
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJI...

# Shopify
SHOPIFY_API_KEY=<from-shopify-partners>
SHOPIFY_API_SECRET=<from-shopify-partners>
SHOPIFY_APP_URL=https://api.loocbooc.com
SHOPIFY_SCOPES=read_products,write_products,read_customers,read_orders

# Server
PORT=3000
NODE_ENV=production
```

### Web (.env)
```bash
VITE_API_URL=https://api.loocbooc.com
```

---

## GitHub Actions (Auto-deploy)

Add these secrets to the repo (Settings → Secrets):

| Secret | Where to get it |
|--------|-----------------|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel → Project → Settings |

---

## Custom Domain Setup

### API: `api.loocbooc.com`
1. Railway → Service → Settings → Custom Domain
2. Add CNAME record: `api.loocbooc.com` → `<railway-domain>`

### Web: `app.loocbooc.com`
1. Vercel → Project → Settings → Domains
2. Add domain and configure DNS

### Main site: `loocbooc.com`
- Can point to Vercel or a separate landing page

---

## Troubleshooting

### "Supabase credentials not configured"
- Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- API will run in memory-mode without them (fine for testing)

### Shopify OAuth fails
- Verify `SHOPIFY_APP_URL` matches your deployed API URL
- Check redirect URL is whitelisted in Shopify Partners

### 3D viewer not loading
- Check browser console for Three.js errors
- Ensure CORS is configured for your frontend domain
