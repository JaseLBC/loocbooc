# Why Loocbooc
## A one-page pitch for technical co-founder candidates
*For distribution after initial interest expressed*

---

## The Problem

The global fashion industry is worth **$2.5 trillion**. It runs on PDFs.

A garment's journey from sketch to consumer looks like this today:

- Tech pack = a PDF emailed to a factory
- Cut patterns = a DXF file in someone's desktop folder
- Fabric spec = a spreadsheet
- 3D sample = a physical garment shipped internationally and back
- Retailer product page = manually re-entered data
- Consumer try-on = guesswork

These systems are disconnected. When something changes, someone manually updates everything. Factories get wrong versions. Physical samples cost $500-2,000 each and take weeks. Returns run at 25-30% in fashion. **The industry loses hundreds of billions of dollars per year to problems that shouldn't exist.**

Nobody has built the infrastructure layer that fixes this.

---

## The Solution

**Loocbooc is the universal cloud infrastructure the global fashion industry runs on.**

Every garment that enters Loocbooc receives a **Universal Garment Identifier (UGI)** — a permanent digital identity. That identity becomes a living file containing:

- Tech pack (measurements, construction specs, grading rules)
- 2D cut patterns (all pieces, all sizes)
- Fabric physics parameters (derived from composition data on care labels)
- Physics-accurate 3D model (generated mathematically from patterns + fabric physics)
- Manufacturing data (factory, batch, sourcing chain)
- Retail data (pricing, colorways, availability)
- Consumer data (try-on interactions, fit feedback, purchase history)
- Lifecycle data (resale, repair, recycling)

**Every party — designer, manufacturer, retailer, consumer — accesses the same file through one identifier. One truth. Always current.**

---

## The Opportunity — Why Now

**Three forces are converging simultaneously:**

**1. EU Digital Product Passport regulation (2027-2030)**
Every garment sold in the EU will legally require traceable material composition, manufacturing chain data, and end-of-life information. This is a global forcing function — every brand selling into Europe must have this infrastructure. Loocbooc's garment UUID is that passport. Brands on Loocbooc are automatically DPP-compliant. Brands not on Loocbooc have a legal problem coming.

**2. AI has made the hard technical problems solvable**
Physics-based fabric simulation from composition data, 3D reconstruction from photos, fit prediction from body measurements — these were research problems 5 years ago. They are engineering problems now. The window to build this infrastructure and establish it as the standard is open for a short time.

**3. Proof of demand already exists**
We have our first brand onboarded (Charcoal Clothing — ~$5M+ Australian fashion brand, US expansion underway). The US market has shown 9x growth signals. The market pull is real — and no equivalent platform exists globally.

---

## What We're Building — Technical Overview

This is the architecture problem:

**Layer 1 — Garment Data Ingestion**
Multi-modal input pipeline: CLO3D/Marvelous Designer files, 2D cut patterns (AI, DXF, HPGL), photo/video scanning (LiDAR + RGB + IMU fusion on iPhone), OCR extraction from PDF tech packs. Every input path produces the same output: a canonical garment data structure.

**Layer 2 — Physics Simulation Engine**
Fabric composition (legally required on care labels) maps deterministically to physical properties: drape, weight, stretch, recovery, rigidity. We build a physics parameter database from this mapping. Every uploaded garment gets accurate fabric simulation without any additional data from the brand.

**Layer 3 — 3D Model Generation**
Cut patterns + fabric physics → mathematically derived 3D garment model. This model exists before the garment is manufactured. More accurate than physical samples because it derives from the source of truth (the pattern), not a physical artefact with variation.

**Layer 4 — Consumer Platform**
Body scan → avatar → physics-accurate virtual try-on. Fit prediction using avatar measurements + garment simulation data. Style intelligence from wardrobe history + try-on behaviour.

**Layer 5 — B2B Infrastructure**
Real-time collaborative garment file (manufacturers see changes as designers make them). DPP compliance automation. Integration with 10+ pattern-making software systems (Gerber, Lectra, Tukatech, CLO3D, etc.). PLM/ERP connectors.

**The data moat:** Every garment uploaded, every try-on interaction, every fit rating trains the model. At 1M garments, Loocbooc has the world's most accurate fabric simulation database. That's a competitive advantage that compounds and cannot be replicated.

---

## What We're Offering

**This is a co-founder conversation, not a job.**

The CTO co-founder will:
- Own the technical vision from the first line of architecture
- Hold a meaningful equity stake in a platform targeting multi-billion dollar valuation
- Build the engineering team from scratch — hire the people, set the culture
- Solve genuinely hard, unsolved technical problems (physics simulation at scale, ML fit prediction, multi-modal garment reconstruction)
- Work alongside a founder who has built and scaled a fashion business (Charcoal Clothing) and understands the industry from the inside

**The timing:** We are at day zero of the build. The window to establish Loocbooc as the industry standard is open and will not be open forever. CLO Virtual Fashion raised $34M in 2024 to build 3D tools. Doji raised $14M in 2025 for consumer try-on. The space is getting attention. The infrastructure layer — the connective tissue underneath all of it — is still unbuilt. We move now.

---

## The Ask

A 30-minute conversation to explore whether this is the right problem for you at the right moment in your career.

We're not looking for someone to run an engineering team as a hired hand. We're looking for the person who will wake up every day wanting to build this — because the problem is that big, and the window is that specific.

If that's you, let's talk.

**Jason Li — Founder & CEO, Loocbooc**

---

*Loocbooc is building the universal operating system for the global fashion industry. From the first sketch to the recycling bin — one platform, one identifier, one truth.*
