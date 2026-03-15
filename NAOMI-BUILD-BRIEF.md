# NAOMI BUILD BRIEF — Loocbooc
*Questions Naomi needs answered to set up the continuous build loop.*
*Jason answers this once. Naomi builds from it indefinitely.*
*Last updated: March 2026*

---

## WHAT'S ALREADY BUILT

The foundation exists:
- Full repo scaffold with monorepo structure
- FastAPI backend with garment UUID, brands, avatars, manufacturers, try-on, scan endpoints
- Next.js 14 brand portal (basic)
- React Native mobile app scaffold
- Python pipeline and physics packages
- Docker Compose local dev (PostgreSQL, Redis, MinIO, all services)
- End-to-end test script
- Architecture doc + spec doc (both thorough)

**What's missing:** Clear, scoped, agent-executable tasks. Without this, every build session stalls at "what do I build next?"

---

## QUESTIONS FOR JASON

Answer these once. Naomi handles the rest.

---

### 1. PRIORITY ORDER — What ships first?

The architecture doc recommends: Back It (Shopify demand validation) as the first live module.
But the codebase is currently built around Garment UUIDs and try-on infrastructure.

**Which matters more to you right now:**

**A) Back It live on Charcoal's Shopify** — demand validation for upcoming drops. Revenue-validating, brand-building, data-generating. Needs: campaign management, MOQ logic, Stripe payments, Shopify plugin.

**B) Garment UUID system + try-on** — the core Loocbooc infrastructure. The thing that makes it defensible long-term. What's partially built now.

**C) Both in parallel** — sub-agents split the work. Back It in one thread, try-on/UUID pipeline in another.

*Your answer determines how I schedule the overnight build queue.*

---

### 2. CHARCOAL FIRST OR LOOCBOOC-NATIVE FIRST?

The architecture has Charcoal as the first Loocbooc brand (the guinea pig + proof of concept).

Do you want me to:

**A) Build the Shopify plugin first** — embedded in Charcoal's store, Loocbooc powers it in the background. Fastest path to live customers.

**B) Build Loocbooc.com as its own platform first** — brand portal, consumer-facing, standalone. Charcoal is just the first brand on it.

**C) Both simultaneously** — the platform and the Shopify plugin share the same API. They can build in parallel.

---

### 3. THE MVP LINE — What does "operational" mean to you?

In MEMORY.md, the 12-month target is: *Operational MVP. $150M valuation. Funding secured.*

For a funding conversation, "operational" usually means one of:
- **Demo-ready** — looks real, some real data, investors can play with it
- **Revenue-generating** — real customers, real transactions, even if small
- **Scale-ready** — architecture proven, ready to onboard 100 brands

Which of these three defines your $150M target?

*This determines how much polish vs. how much speed the build loop prioritises.*

---

### 4. ACCOUNTS + AUTH — Who can access the platform right now?

The current codebase has API key auth. The architecture doc specifies Supabase Auth with roles (consumer, brand, stylist, manufacturer, admin).

**Do you want me to:**

**A) Build Supabase Auth now** — proper login, roles, sessions. Takes ~3 days of agent time.

**B) Keep API key auth for now** — faster to build features, add proper auth before funding demo.

*For Charcoal's team to use this, they need a login. When does that need to exist?*

---

### 5. THE OVERNIGHT LOOP — When can agents run?

I can queue build tasks that run overnight and you wake up to shipped code.

**What I need from you:**
- Is GitHub connected to this workspace? (The repo is at `/Users/megatron/.openclaw/workspace/loocbooc/`)
- Do you want agents to commit directly to `main`, or to feature branches with PRs?
- Any services I should NOT touch without asking? (e.g., the Charcoal Shopify store — I'd never touch that without explicit confirmation)
- Are there any API keys or credentials already set up in the project I should know about?

---

### 6. THE CTO QUESTION — What's the status?

MEMORY.md flags: *No technical co-founder identified yet. THE ICONIC alumni, Afterpay alumni, Canva engineering leads are the target pool.*

Two paths:
**A) Naomi builds until CTO arrives** — agents do the build, I coordinate. Slower, but it's moving.
**B) Use the build progress to attract the CTO** — a live, working platform is a better recruiting tool than a deck. We build to impress.

Both are compatible. I just want to know how you're thinking about the interplay between AI build velocity and the CTO search.

---

### 7. SHOPIFY SPECIFICS — If Back It is the priority:

To build the Shopify embedded app, I'll need:
- Charcoal's Shopify store URL (I have `charcoal-online.myshopify.com` from context — confirm?)
- A Shopify Partner account to create the app (do you have one?)
- A Shopify API key + secret (or permission for me to create a partner app)

I will NOT touch the live Charcoal store without your explicit "SEND." I'll build against a development store or staging environment only until you confirm.

---

### 8. THE QUICK WIN — What would make you feel like this is working?

Is there one thing — one screen, one feature, one demo — that would make you feel the momentum is real?

Name it. I'll make it the first deliverable.

---

## HOW THE LOOP WORKS ONCE YOU ANSWER

1. You answer the 8 questions above (even bullet points are fine)
2. Naomi converts your answers into a **prioritised task queue** in `loocbooc/TASKS.md`
3. Each task is scoped to be agent-executable: specific, unambiguous, testable
4. Overnight: Naomi spawns ACP coding agents to work through the queue
5. Morning: you get a briefing — what was built, what's working, what's next
6. You review, redirect, add to the queue
7. Repeat daily

The queue is never empty. While you sleep, Loocbooc grows.

---

*File this under: the 2 hours that unlocks everything.*
