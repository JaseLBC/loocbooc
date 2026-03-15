# LOOCBOOC — TASK QUEUE
*Naomi-managed. Updated continuously. Agent-executable.*
*Priority: top of each section = build next.*
*Last updated: March 16, 2026*

---

## BUILD PHILOSOPHY (from Jason, March 16)

- **Both tracks parallel:** Shopify plugin (demand validation) + garment UUID/try-on (core infrastructure)
- **Loocbooc-native first:** platform lives at loocbooc.com, Charcoal is first brand on it
- **Demo-ready but fully functional:** real garments, real Charcoal clients, real manufacturers, real stylists — everything connected and tested
- **Auth later:** API key for now, add Supabase Auth before funding demo
- **GitHub:** feature branches, PRs, never commit directly to main
- **NEVER touch:** live Shopify store, live payment systems, anything that affects Charcoal's live business — without Jason's explicit confirmation
- **Quick win target:** scanning interface + 3D digitised garment viewer + avatar profile with 3D body

---

## TRACK A — SHOPIFY DEMAND PLUGIN (formerly "Back It")

### ⚠️ NAME CHANGE NEEDED
"Back It" is functional but not elevated enough for the brand. Jason wants options.
See name suggestions at bottom of this file.
**Action: Jason picks the name before we build consumer-facing copy.**

### A1 — Campaign Data Model & API [NEXT]
**What:** Full campaign schema and REST API. All fields needed to make this work in the real world.
**Scope:**
- Campaign model: garment_id, title, description, status, retail_price, campaign_price, deposit_percent, moq, current_count, moq_reached, campaign_start, campaign_end, estimated_ship_date, manufacturer_id, available_sizes, size_limits, cover_image, gallery_urls, shopify_product_id
- Backing model: campaign_id, user_id, size, quantity, total_cents, deposit_cents, remaining_cents, stripe_payment_intent_id, status, shipping_address
- Campaign size breaks table (live snapshot of size distribution)
- Campaign events audit log
- All CRUD endpoints for brand dashboard
- Consumer GET endpoints (browse, by slug)
- Backing POST/DELETE endpoints
- MOQ threshold logic (atomic increment + trigger)
- Campaign expiry logic (auto-refund)
- Internal cron endpoint for MOQ check + expiry sweep
**Branch:** `feature/campaign-api`
**Test:** `scripts/test-campaign-api.sh` must pass end-to-end

### A2 — Stripe Integration [AFTER A1]
**What:** Payment processing for backings. Full payment upfront for MVP (deposit model in v2).
**Scope:**
- Stripe PaymentIntent create on backing placement
- stripe.payment_intent.succeeded webhook → confirm backing, increment MOQ counter
- stripe.payment_intent.payment_failed webhook → mark backing failed, notify user
- Refund creation on campaign expiry (auto) or user cancellation (pre-MOQ)
- Idempotency keys on all Stripe calls
- stripe_charge_id stored on backing for refund reference
**Branch:** `feature/stripe-payments`
**Test:** Stripe test mode, full happy path + refund path

### A3 — Materials Database [AFTER A1, CAN PARALLEL A2]
**What:** The fabric/material layer that makes garment profiles real.
**Scope:**
- Material model: name, composition (JSON: [{fibre: "cotton", percent: 95}, {fibre: "elastane", percent: 5}]), weight_gsm, weave_type (woven/knit/non-woven), weave_structure, finish_treatments[], care_instructions[], certifications[], drape_coefficient, stretch_percent, recovery_rate, breathability_score, sheen_level, hand_feel
- Physics parameters auto-derived from composition (map fibre types → simulation params)
- OCR endpoint: photo the care label → extract composition → auto-populate material
- Material search (by composition, cert, weight range)
- Brand can link materials to garments
- Seed: 50 common materials (cotton jersey, silk charmeuse, viscose crepe, etc.)
**Branch:** `feature/materials-database`

### A4 — Product Profiles (Garment Detail) [AFTER A1 + A3]
**What:** Every garment that goes on a campaign needs a complete profile. This is the "garment file" from the spec.
**Scope:**
- Full tech pack fields: measurements by size (JSON grid), construction specs, stitch types, trims list, grading rules
- Material linkage (from A3)
- Size chart: measurements per size in AUD/US/EU sizing
- Colour variants (each with colour code, swatch image, available sizes)
- Care instructions
- Sustainability data (country of origin, certifications, fibre source)
- PDF tech pack generation (downloadable)
- 3D model upload field (GLB/GLTF, links to try-on pipeline)
- Gallery: multiple images per garment + per colourway
- Draft/published status (unpublished garments visible to brand only)
**Branch:** `feature/garment-profiles`

### A5 — Manufacturer Profiles [AFTER A1, CAN PARALLEL A3]
**What:** Manufacturers need real profiles to be linked to campaigns meaningfully.
**Scope:**
- Manufacturer model: name, country, city, specialisations[], certifications[], min_order_qty, max_capacity_units_per_month, lead_time_days_min/max, price_tier, verified, rating_avg, contact_email, website
- Manufacturer capability matrix (which garment categories, which fabrics, which certifications)
- Capacity calendar: mark lead times, blackout dates, current load
- When campaign hits MOQ → manufacturer notification email with: size break PDF, tech pack link, target ship date
- Manufacturer dashboard: see campaigns assigned to them, confirm production, update status
- Manufacturer search (by specialisation, country, MOQ, certifications)
- Seed: at minimum one test manufacturer (can use Charcoal's actual manufacturer details if Jason provides)
**Branch:** `feature/manufacturer-profiles`

### A6 — Brand Dashboard (Campaign Management UI) [AFTER A1-A5]
**What:** The brand-facing Next.js UI to create and manage campaigns. This is what Charcoal's team uses.
**Scope:**
- Campaign creation flow: step-by-step (select garment → set pricing → set MOQ → set dates → link manufacturer → preview → publish)
- Campaign list view: status, current backing count vs MOQ, revenue, days remaining
- Campaign detail: live backing count, size break chart, backer list (size + deposit status), revenue breakdown
- Garment profile builder (from A4)
- Material selector (from A3)
- Manufacturer selector (from A5)
- Simple analytics: backing velocity graph, size break donut, revenue timeline
**Branch:** `feature/brand-dashboard`

### A7 — Consumer Campaign Page [AFTER A1-A2]
**What:** The public-facing page where customers see and back campaigns. This is the demo-worthy screen.
**Scope:**
- Campaign hero: garment imagery, 3D viewer if model exists (static GLB), campaign name + description
- Real-time MOQ progress bar (Supabase Realtime or polling fallback)
- Size selector (pre-selected if avatar logged in)
- Price breakdown: campaign price vs retail price (savings highlighted)
- Estimated ship date
- Social proof: "X people have backed this"
- One-tap backing flow → Stripe checkout → confirmation screen (celebratory, not a receipt)
- Mobile-first. Apple Pay / Google Pay where possible
- Matches design principles doc (elevation, typography, motion)
**Branch:** `feature/campaign-consumer-page`

### A8 — Shopify Plugin (embedded app + theme extension) [AFTER A7 COMPLETE]
**What:** Inject the campaign widget into Charcoal's Shopify product pages.
**Note:** Requires Jason to set up a Shopify Partner account and provide API credentials. Build against development store ONLY. Never touch the live store without explicit confirmation.
**Scope:**
- Shopify Partner app registration (Jason does this step)
- OAuth flow: brand installs app → access token stored encrypted → webhooks registered
- Embedded app: campaign management UI inside Shopify Admin (reuses brand dashboard components)
- Theme app extension: Back It widget injected into product pages (real-time progress bar, size selector, CTA)
- Webhook handlers: orders/create, orders/paid, orders/cancelled
- Shopify ↔ Loocbooc order sync
- Test on Shopify development store
**Branch:** `feature/shopify-plugin`
**Blocked on:** Jason creates Shopify Partner account + provides dev store URL

---

## TRACK B — AVATAR + SCANNING + 3D VIEWER

### B1 — Avatar Profile Schema & API [NEXT, PARALLEL TO A1]
**What:** The data model and API for consumer avatars. Everything needed to represent a real human body.
**Scope:**
- Avatar model: user_id, nickname, height, weight_kg, bust, waist, hips, inseam, shoulder_width, sleeve_length, neck, chest, thigh, rise, body_shape, fit_preference, skin_tone, hair_colour, avatar_3d_url, avatar_img_url, size_au/us/eu, measurement_method, confidence_score
- Avatar customisation options: hair style, skin tone, face profile (for visual representation — not for fit calculation)
- Multiple avatars per user (for gifting, family, etc.)
- Fit profile: preferred brands, size notes, past fit feedback
- Avatar is "game character" level of customisation — this is the design principle
- CRUD endpoints
- Avatar-to-garment fit scoring (given avatar measurements + garment size chart → recommend size + fit notes)
**Branch:** `feature/avatar-api`

### B2 — Photo Library Avatar Reconstruction [AFTER B1, HIGH PRIORITY]
**What:** Build a 3D avatar from the user's existing photo library. No guided scan required. This is the primary avatar creation path for most users.
**Scope:**
- iOS: `PHPhotoLibrary` permission request with clear, plain English explanation
- Android: `READ_MEDIA_IMAGES` permission equivalent
- On-device photo scanning: detect photos containing the user (face + body detection using on-device ML — Vision framework iOS, ML Kit Android)
- Filter to usable photos: full-body, 3/4, waist-up — reject selfies-only, extreme crops
- Report to user: "Found X photos of you. Using Y for body reconstruction."
- Measurement collection flow: height → bust → waist → hips → (optional: weight, shoe size) — one field at a time, conversational, not a form
- On-device SfM pipeline: multi-image geometry extraction from filtered photos
- Body mesh fitting: extracted geometry + entered measurements → parametric body model (SMPL or equivalent)
- Confidence scoring based on number and diversity of usable photos
- Output: avatar mesh + measurements written to avatar model
- Avatar reveal moment (see B3 for the renderer — this feeds into it)
- Privacy: ALL photo processing on-device. Only final mesh + measurements transmitted. Never raw photos.
- Processing time target: under 30 seconds on a 2022+ phone
**Branch:** `feature/photo-library-avatar`
**IP flag:** Do not publish or demo this feature publicly before provisional patent is filed.

### B3 — Body Scanning Interface — Live Camera [AFTER B1]
**What:** The scanning flow on mobile. iPhone-first. This is the "quick win" screen Jason wants.
**Scope:**
- React Native scanning screen: camera + LiDAR (iPhone Pro) + IMU fusion
- Guided scan flow: animated prompts ("turn left," "raise arms") — feels like a ritual, not a form
- Progress: animated, not a percentage bar
- Fallback for non-LiDAR phones: multi-photo measurement estimation
- Manual measurement entry as third option (for desktop or non-camera scenarios)
- On scan complete: processing animation → avatar reveal moment (this is THE moment — treat it as such)
- Output: body measurements written to avatar model
- Accuracy confidence score based on input method
**Branch:** `feature/body-scanning-mobile`

### B3 — Avatar 3D Viewer [AFTER B1]
**What:** The "game character" 3D avatar viewer. Real-time, interactive, customisable.
**Scope:**
- Three.js (or React Three Fiber) avatar renderer
- Base body mesh parameterised by measurements (height, weight, bust/waist/hips morphs)
- Avatar customisation: skin tone, hair style, hair colour (presets — not full character creator, but meaningful)
- Orbit controls: rotate, zoom, pan — feels like a game
- Lighting: flattering, fashion-appropriate (not harsh 3D software lighting)
- Web and mobile (React Native with Expo GL or WebView renderer)
- Avatar always shown wearing something — never naked mesh
**Branch:** `feature/avatar-3d-viewer`

### B4 — Garment 3D Viewer [AFTER garment 3D model pipeline exists]
**What:** View a digitised garment in 3D. Second part of the "quick win."
**Scope:**
- GLB/GLTF garment model renderer (Three.js)
- Orbit controls: spin the garment, zoom in, inspect construction
- Lighting rig: fashion photography style (soft, directional)
- Colourway switcher (if multiple colours, swap texture/material)
- "Wear on avatar" button → loads avatar viewer with garment draped
- Web and mobile
**Branch:** `feature/garment-3d-viewer`

### B5 — Avatar + Garment Composite (Try-On) [AFTER B3 + B4]
**What:** Avatar wearing the garment. Physics-accurate drape. The hero feature.
**Scope:**
- Cloth simulation: garment mesh draped over avatar mesh using fabric physics (existing physics package)
- Fabric parameters from material database (drape, stretch, weight)
- Fit indicator: areas where garment is tight shown in amber, areas where loose shown in blue, perfect fit in neutral
- Recommended size callout
- "See on your body" — consumer tries on a campaign garment before backing
- Performance: must load in under 3 seconds on mobile
**Branch:** `feature/try-on-composite`

### B6 — ScanSuit Spec [DESIGN TASK — NO CODE YET]
**What:** Define the ScanSuit product spec before building calibration logic.
**Scope:**
- Garment design spec: fabric type, print pattern (lattice/crosshatch), QR code placement, sizes
- QR code encoding spec: what data is encoded (garment exact dimensions per size, manufacturer ID, date)
- Calibration logic: scan detects QR → reads exact dimensions → uses as ground truth for body scan calibration
- Output: `loocbooc/docs/scansuit-spec.md`
- IP note: flag for provisional patent filing
**Branch:** N/A (doc task)
**Owner:** Naomi drafts, Jason reviews

---

## TRACK C — PLATFORM FOUNDATION

### C1 — GitHub Repo Setup [DO FIRST]
**What:** Connect local repo to GitHub. Branch protection. CI basics.
**Scope:**
- Create GitHub repo (private): `loocbooc/loocbooc`
- Push current codebase to main
- Branch protection: main requires PR + 1 approval (or agent-authored PRs auto-approved for now)
- GitHub Actions: lint + typecheck on PR
- `.gitignore` audit (no secrets, no node_modules, no .env)
**Note:** Jason — do you want to create the repo or should I create it under your GitHub account? I need your GitHub username/org to push.

### C2 — Environment Config Audit [DO FIRST]
**What:** Ensure .env structure is clean and documented. No secrets in code.
**Scope:**
- `.env.example` files for all packages
- All secrets moved to env vars (no hardcoded keys anywhere)
- Local dev `.env` documented
- Staging and production env var list documented
**Branch:** `feature/env-audit`

### C3 — Email Notifications (Resend) [AFTER A2]
**What:** Transactional emails for campaign events.
**Scope:**
- Backing confirmation email
- MOQ reached email (to all backers + brand)
- Campaign expired + refund confirmation email
- Manufacturer notification email (size break PDF attached)
- Estimated ship date update email
- Templates: clean, brand-appropriate, mobile-optimised
- Resend integration
**Branch:** `feature/email-notifications`

---

## WHAT JASON STILL NEEDS TO PROVIDE

These are blockers — nothing can proceed without them:

| Item | Why needed | Priority |
|---|---|---|
| **Plugin name decision** | Consumer-facing copy can't be written until name is locked | 🔴 Before A7 |
| **GitHub username or org** | To create and push the repo | 🔴 Before C1 |
| **Shopify Partner account** | Cannot build or test Shopify plugin without it | 🟡 Before A8 |
| **Test manufacturer details** | To seed a real manufacturer for testing (can use a fictional one for now) | 🟡 Before A5 |
| **Charcoal's garment sizing data** | Size charts for real garments to test fit scoring | 🟡 Before B1 fit scoring |
| **Confirmation: Charcoal's Shopify URL** | Confirming `charcoal-online.myshopify.com` — for mapping, never for touching live | 🟢 Confirm when ready |

---

## NAME OPTIONS FOR THE SHOPIFY PLUGIN

"Back It" works but it's startup-sounding. Options that are more elevated:

**Commerce/fashion-aligned:**
- **Reserve** — clean, premium, implies exclusivity. "Reserve this style." Simple.
- **Pioneer** — backs the idea of being first. "Be a Pioneer." Has movement energy.
- **Ante** — poker term for "in before production." Edgy, memorable, unusual.
- **First Cut** — fashion metaphor (first cut of fabric = start of production). Double meaning: first access.
- **Edition** — "This is a limited edition run. Back it to exist." Works as: Edition by Loocbooc.
- **Founding** — "Founding customers." Premium, implies founding member status.

**More abstract/platform-branded:**
- **MAKE** — stripped back. "MAKE this exist." Verb-as-product.
- **Manifest** — fashion meets intention. Elevated. "Manifest this style."
- **Signal** — you signal demand. The platform reads it. Truthful to what it is.
- **Commit** — clean, simple. "Commit to this style." Also implies confidence.

**Jason picks. Naomi builds.**

---

*Queue is live. Agents pull from top of each track.*
*Jason can add, reprioritise, or kill any task at any time.*
*Nothing moves to production without Jason's sign-off.*
