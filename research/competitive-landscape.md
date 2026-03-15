# Loocbooc — Competitive Landscape
## Fashion-tech competitive intelligence: who's building what, funding status, and where Loocbooc wins
*Research compiled: March 2026*

---

## MARKET CONTEXT

The virtual try-on and fashion infrastructure market is experiencing a defining moment:

- **Global fashion tech funding 2024:** $2.97 billion across 200+ rounds
- **Virtual fitting room market:** ~$6.9B in 2024, projected to grow to $100B+ by 2034
- **US fashion tech 2024:** $1.06B raised across 51 rounds (up 3.22% from 2023)
- **Key driver:** EU Digital Product Passport regulation (2027-2030) is creating massive compliance infrastructure demand
- **Generative AI shift:** 2024 saw move away from 2D overlay try-on to diffusion models simulating fabric behaviour

This is signal. Money is moving into this space. The window for Loocbooc to establish the standard is real but not unlimited.

---

## COMPETITOR MAP

### TIER 1: DIRECT COMPETITORS (SOLVING SIMILAR PROBLEMS)

---

#### 1. CLO Virtual Fashion
**What they do:** 3D garment simulation software (CLO3D) — the industry-standard tool for designers to create virtual garments before physical production
**Funding:** $34 million raised in 2024
**Backers:** Korean VC (CLO is a Korean company — CLO Virtual Fashion Inc.)
**Technical approach:** Desktop software (not cloud-first), physics-based fabric simulation, pattern-to-3D generation, professional design tool workflow
**Who uses them:** Designers, fashion brands, design schools — ~300,000 users globally
**Revenue model:** Subscription SaaS for designers
**Where Loocbooc is differentiated:**
- CLO is a TOOL used by designers. Loocbooc is INFRASTRUCTURE used by the entire industry
- CLO doesn't create a universal identifier — there's no persistent garment UUID that follows the garment through manufacturing, retail, and consumer purchase
- CLO doesn't connect manufacturers to retailers to consumers — it ends at the design stage
- CLO doesn't address DPP compliance
- CLO doesn't have a consumer-facing try-on product
- CLO is desktop-first — Loocbooc is cloud-native and collaborative
**Opportunity:** CLO's 300,000 users are a WARM MARKET for Loocbooc integration. CLO file import is already in Loocbooc's integration spec. These designers are potential first-wave Loocbooc users.
**Threat level:** Medium. They could extend into the infrastructure layer. Their $34M raise signals they're accelerating — they may try to expand beyond design tools.

---

#### 2. Browzwear (VStitcher)
**What they do:** Enterprise 3D garment design and development platform — aimed at larger fashion brands and manufacturers
**Funding:** Private (acquired by Battery Ventures ecosystem; exact funding unclear)
**Technical approach:** Enterprise SaaS, 3D simulation, pattern-making integration, product lifecycle management
**Who uses them:** Major fashion brands (PVH, Nike, H&M level), global manufacturers
**Revenue model:** Enterprise licensing
**Where Loocbooc is differentiated:**
- Browzwear is enterprise-only — requires large-scale integration projects. Loocbooc is accessible to any brand, any size
- No consumer-facing layer
- No universal garment identifier
- No DPP compliance infrastructure
- Browzwear is a replacement for existing workflows; Loocbooc connects to existing workflows without replacing them
**Threat level:** Medium. Strong enterprise moat with existing customers. Less likely to pivot to consumer infrastructure.

---

#### 3. Optitex (EFI Optitex)
**What they do:** Pattern-making and 3D simulation software, integrated with EFI (electronics for imaging) manufacturing systems
**Funding:** Part of EFI (publicly traded before privatisation); significant enterprise backing
**Technical approach:** Pattern-making software + 3D simulation, manufacturing workflow integration
**Who uses them:** Global apparel manufacturers, factories
**Revenue model:** Enterprise software licensing
**Where Loocbooc is differentiated:**
- Same differentiators as CLO/Browzwear — tool, not infrastructure
- No consumer layer, no universal UUID, no DPP
**Opportunity:** Loocbooc's integration spec includes Optitex — means manufacturers who use Optitex can feed directly into Loocbooc without workflow disruption.

---

### TIER 2: CONSUMER VIRTUAL TRY-ON (PARTIAL OVERLAP)

---

#### 4. Doji
**What they do:** AI-powered virtual try-on app using diffusion model-generated avatars — users create a photorealistic avatar from selfies and try on clothes
**Funding:** $14 million seed round (May 2025) — led by Thrive Capital, with Alexis Ohanian's Seven Seven Six
**Founders:** Dorian Dargan (ex-Apple VisionOS, ex-Meta Oculus) + Jim Winkens (ex-DeepMind, ex-Google)
**Technical approach:** Diffusion models for avatar generation, consumer social app, invite-only, 80+ countries
**Who uses them:** Consumers — primarily Gen Z, social/fashion-forward
**Revenue model:** Consumer freemium, likely commerce affiliate
**Where Loocbooc is differentiated:**
- Doji does consumer try-on. Loocbooc does consumer try-on + the entire supply chain infrastructure underneath it
- Doji generates avatar images for fashion exploration. Loocbooc uses physics simulation from actual garment pattern data — more accurate
- Doji has no connection to manufacturing, no DPP, no B2B layer
- Doji is a consumer product. Loocbooc is infrastructure that happens to have a consumer product on top
**Threat:** If Doji raises a Series A and expands scope, they could try to build the B2B layer. Their founder backgrounds (Apple VisionOS + DeepMind) are formidable.
**Key intelligence:** Doji raised $14M in May 2025. They're early stage but well-backed. The consumer try-on race is real. Loocbooc needs to move on consumer layer while building infrastructure.

---

#### 5. True Fit
**What they do:** The "Fashion Genome" — a fit and style data platform used by 250+ retailers to give shoppers personalised size recommendations
**Funding:** Series D / significant — over $60M raised historically
**Technical approach:** ML fit recommendation engine trained on hundreds of millions of shopper profiles and brand garment data
**Who uses them:** Major retailers (Burberry, Tommy Hilfiger, Nordstrom, etc.) as an embedded widget
**Where Loocbooc is differentiated:**
- True Fit is a fit RECOMMENDATION engine. Loocbooc is a garment SIMULATION engine — physics-based, not data-correlation-based
- True Fit doesn't generate 3D models
- True Fit doesn't address the manufacturing/supply chain side
- True Fit's data is locked inside retailer integrations — not a universal standard
**Opportunity:** True Fit's brand relationships are a potential partnership pathway. Their data complements Loocbooc's physics-based approach.

---

#### 6. Sizer
**What they do:** Body measurement technology — users get precise body measurements through their mobile camera, used for size recommendation
**Funding:** ~$20M+ raised
**Technical approach:** Computer vision for body measurement, SaaS integration with retailers
**Where Loocbooc is differentiated:**
- Sizer solves the body measurement side. Loocbooc needs both body measurement AND garment physics
- Potential partnership: Sizer body measurement data feeds into Loocbooc avatar
- No manufacturing infrastructure, no DPP

---

### TIER 3: DIGITAL PRODUCT PASSPORT / TRACEABILITY (REGULATORY COMPLIANCE PLAY)

---

#### 7. Retraced
**What they do:** Fashion supply chain sustainability and traceability platform — helps brands map their supply chains, manage supplier data, and prepare for DPP compliance
**Funding:** €15 million Series A (September 2024) — led by Partech, with Alante Capital, Alstin Capital, Samaipata, F-Log Ventures
**Clients:** 150+ fashion brands including Desigual, Victoria Secret, Pangaia, Calzedonia, Tom Tailor, Marc O'Polo
**Technical approach:** Supply chain data platform, supplier collaboration tools, sustainability reporting, DPP preparation
**Where Loocbooc is differentiated:**
- Retraced focuses on SUPPLY CHAIN SUSTAINABILITY and traceability (knowing who made your fabric and where)
- Loocbooc's DPP is about the GARMENT FILE itself — the physics-accurate 3D model, the design data, the material composition
- These are complementary, not competing — Retraced tracks who/where; Loocbooc is what/how
**Opportunity:** Potential integration or partnership — Retraced's supply chain data feeds into Loocbooc's DPP fields. Could be a white-label or API relationship.
**Threat:** Retraced has 150+ brand clients and €15M to expand. If they decide to expand from traceability into full garment digital passports, they have the brand relationships already.

---

#### 8. EON Group
**What they do:** Digital identity for fashion products — uses QR codes/NFC on clothing labels to create a "connected product experience" for consumers
**Funding:** Series B / substantial — backed by major fashion brands as clients (H&M, Coach, Net-a-Porter, Pangaia)
**Technical approach:** Digital twin via connected labels, IoT-enabled product identity, consumer QR experience
**Where Loocbooc is differentiated:**
- EON creates a CONNECTED LABEL — a QR code that links to product information
- Loocbooc creates a living PHYSICS-ACCURATE GARMENT FILE — not just a product page link, but a complete simulation environment
- EON's digital twin is metadata-focused; Loocbooc's is simulation-focused
- No virtual try-on, no physics simulation, no design-to-manufacturing connection
**Threat level:** Medium-High. EON has brand relationships and DPP positioning. If they add 3D simulation capability (through acquisition or build), they become a more serious threat.

---

### TIER 4: 3D DESIGN TOOLS (ADJACENT)

---

#### 9. Marvelous Designer
**What they do:** 3D clothing design and simulation software — artist-grade garment simulation widely used in gaming, film, and increasingly fashion
**Funding:** Private (Korean company — CLO Virtual Fashion and Marvelous Designer share heritage)
**Technical approach:** Physics-based simulation, primarily creative/entertainment industry
**Where Loocbooc is differentiated:**
- Entertainment/gaming focus vs. fashion industry focus
- No supply chain or DPP capability
- No consumer try-on
**Opportunity:** File format integration (`.avt` format) is already in Loocbooc's spec

---

#### 10. Style3D
**What they do:** 3D fashion design software (Chinese company, rapidly growing)
**Funding:** Significant Chinese VC backing
**Technical approach:** Similar to CLO/Browzwear — 3D simulation, pattern to garment, designer workflow
**Where Loocbooc is differentiated:**
- Same differentiation as CLO/Browzwear
- Style3D is primarily China-focused
**Threat level:** Low-Medium for AU/EU market. High for Asia.

---

### TIER 5: THE GOOGLE/AMAZON THREAT

**Google Virtual Try-On:** Google has integrated AI try-on into Google Shopping. This is a 2D image-overlay experience, not physics simulation. Google's approach is: "show a model wearing this garment in a different body type" — which is generated from product photos, not garment pattern data.

**Amazon:** Amazon has experimented with virtual try-on. Same limitation — photo-based overlay, not physics-based simulation from garment data.

**Where Loocbooc wins:** The big tech players are building consumer EXPERIENCES built on existing product photography. Loocbooc is building the INFRASTRUCTURE — the garment file itself, the physics engine, the DPP layer. These are not the same thing and cannot easily be replicated by simply applying AI to product photos.

---

## RECENT FUNDING ROUNDS (SIGNALS THE WINDOW IS REAL)

| Company | Amount | Date | What it signals |
|---------|--------|------|-----------------|
| CLO Virtual Fashion | $34M | 2024 | The 3D garment simulation market is real and scalable |
| Doji | $14M seed | May 2025 | Consumer virtual try-on is a fundable category |
| Retraced | €15M Series A | September 2024 | DPP compliance infrastructure is attracting VC |
| Syre (sustainable materials) | Major round | 2024 | Fashion sustainability infrastructure broadly funded |
| True Fit | Ongoing | Historical | Fit data has been fundable for a decade |
| Fashion tech globally | $2.97B | 2024 | The entire category is attracting capital |

**The key insight:** Nobody has raised money for what Loocbooc is specifically building — the universal garment infrastructure layer. The adjacent markets are funded; the connective tissue between them is not. That's the gap.

---

## WHERE LOOCBOOC IS GENUINELY DIFFERENTIATED

**What nobody else has built:**
1. A universal garment UUID that persists from design through manufacturing through retail through consumer purchase through end-of-life
2. Physics simulation derived from care label composition data (no brand input required beyond a label photo)
3. The connection between the design/manufacturing layer and the consumer try-on layer through a single persistent identifier
4. A platform that simultaneously serves: designers, manufacturers, retailers, AND consumers through one data object
5. The DPP compliance infrastructure baked in from day one — not retrofitted

**The moat that builds over time:**
- Fabric physics database (becomes the world's most accurate after 1M garments)
- Fit prediction model (improves with every try-on interaction and return/fit rating)
- Brand onboarding (each brand onboarded increases value for all other brands — network effect)
- Consumer avatars (a consumer's avatar becomes more valuable the more brands are on the platform)

---

## ACQUISITION TARGETS AND PARTNERSHIP OPPORTUNITIES

**Potential partnership/integration targets:**
- **Retraced** — Supply chain data for DPP fields; mutual clients possible
- **Sizer** — Body measurement data for avatar creation
- **True Fit** — Brand relationships; potential data sharing
- **CLO Virtual Fashion** — File format integration already in spec; possible white-label partnership

**Potential acquisition targets (if funding allows):**
- Any small 3D garment startup that has built a physics engine or garment database
- Any Australian fashion-tech startup with brand relationships that can be converted to Loocbooc
- Fabric physics database companies (there are academic/research spinouts in this space)

---

## COMPETITIVE RISK SUMMARY

| Risk | Likelihood | Timeline | Mitigation |
|------|-----------|----------|-----------|
| CLO Virtual Fashion builds DPP layer | Medium | 2026-2027 | Move faster; establish brand relationships first |
| EON Group adds 3D simulation | Medium | 2027+ | Differentiate on physics accuracy and manufacturing integration |
| Doji raises Series A and expands to B2B | Low-Medium | 2026-2027 | Consumer layer needs to be in market before they expand |
| Google/Amazon build garment file infrastructure | Low | 3+ years | Niche manufacturing integrations they won't bother with |
| New well-funded AU startup copies model | Low | Unlikely | First mover + data moat is the answer |

**Bottom line:** The window is real, competitors are moving, but nobody is building the specific combination Loocbooc is building. Move now.
