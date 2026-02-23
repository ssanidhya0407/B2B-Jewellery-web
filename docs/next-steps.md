# AI-Powered B2B Jewellery Sourcing Platform — Next Steps

This repo already implements a strong MVP skeleton:
- **Frontend**: Next.js 14 portals (`apps/web`, `apps/dashboard`)
- **Backend**: NestJS API (`packages/api`)
- **Data**: Postgres + **pgvector** via Prisma (`packages/database`)
- **Storage**: MinIO (S3-compatible) for image uploads
- **AI**: Gemini Vision for attribute extraction + embedding generation (currently text-embedding based)

Below is a concrete plan to align the current app to your updated requirements (reverse catalog + tiered sourcing + mandatory buyer category).

---

## 1) Current Implementation vs Your Requirements

### Already present
- Image upload pipeline (`POST /api/images/upload`) + async analysis/polling.
- Image sessions + embeddings + recommendations data model (Prisma + pgvector).
- Inventory matcher + manufacturer matcher (vector similarity).
- Cart (intended order) + internal quotation workflow (dashboard-facing APIs).
- Admin APIs for margin configs + inventory/manufacturer catalog CRUD.

### Key gaps (for your new spec)
- **Buyer category selection is not enforced end-to-end** (now addressed in code).
- **Tier definitions** need tightening:
  - Tier 1 internal “exact” match threshold **≥ 0.95** similarity.
  - Tier 2 “Alibaba” sourcing should be attribute + price constrained (MVP uses manufacturer catalog as the external source; add an ingestion/scraping job next).
  - Tier 3 alternatives should return **5–8** designs (MVP now targets 8 tiles: 1 primary + 7).
- **Markup rules** should support global + per-category; internal inventory price should be “exact”, manufacturer should be a range.
- **Brand system integration** (2 existing inventory systems) needs a connector layer + API contracts.

---

## 2) Recommended Tech Stack (by Component)

### Web apps (buyer + admin)
- Keep: **Next.js 14 + Tailwind + TypeScript**
- Add (as needed): TanStack Query for polling/caching; a component library (Radix is already in dashboard)

### Backend
- Keep: **NestJS** (modules already map well: images, recommendations, carts, quotations, admin)
- Add:
  - Background jobs: **BullMQ + Redis** (or Cloud Tasks/SQS) for image processing & inventory sync
  - Observability: OpenTelemetry + structured logging (pino)

### Data
- Keep: **Postgres + pgvector** (good for MVP and early scale)
- Add:
  - Row-level audit log table for internal overrides/actions
  - Optional: OpenSearch/Meilisearch later if you need text search across catalogs

### AI/ML
- Attribute extraction (structured JSON): Gemini Vision / GPT-4o / Claude Vision (all viable)
- Image embeddings (critical for “>95% similarity” meaningfully):
  - MVP: keep current approach (attribute-text → text embedding)
  - Production: switch to **true image embeddings** (e.g., CLIP/SigLIP) and store vectors in pgvector
  - Optional later: category-specific fine-tuning or metric learning on your own matches

### Storage
- Keep: MinIO (dev) → S3/GCS (prod)
- Add: image lifecycle policy + signed URLs

### External sourcing (“Alibaba”)
- Prefer **data ingestion** (scheduled crawling + normalization into `manufacturer_catalog`) over real-time scraping per user request.
- Real-time scraping can still exist as a “last-mile” fill, but expect higher latency and breakage.

---

## 3) MVP Prioritization (Build Order)

### P0 (MVP “works”)
1) Upload design → **mandatory category** + optional max unit price → session created
2) Attribute extraction + embeddings
3) Tiered matching:
   - Tier 1 internal exact match (≥0.95)
   - Tier 2 external catalog (manufacturer/alibaba dataset)
   - Tier 3 alternatives (5–8 total)
4) Buyer saves items to cart → submit “Request Quote”
5) Dashboard: view incoming requests + update statuses + create/send quotation
6) Admin: configure markups (global + per category)

### P1 (conversion + ops efficiency)
- Comparison view + filters (price/MOQ/lead time/source)
- Save searches + re-run from history
- Internal override tools: “swap primary”, “hide item”, “force external”, “edit attributes”

### P2 (scale + defensibility)
- True image embedding model + evaluation harness
- Brand-system live sync + webhooks
- Supplier performance scoring + quote outcomes loop

---

## 4) Brand Inventory API Integration — Requirements Spec (for your 2 brands)

You want a connector layer that can:
- fetch **catalog** (images + attributes)
- fetch **pricing/base cost**
- fetch **availability/stock + lead time**
- optionally receive **updates** (webhooks)

### Authentication
Support one of:
- OAuth2 client credentials, or
- API keys + HMAC signing, or
- mTLS (B2B friendly)

### Required endpoints (minimum)

**Catalog listing**
- `GET /products?updated_since=...&cursor=...&limit=...`
- Returns: `id`, `sku_code`, `name`, `category`, `image_urls[]`, `attributes{...}`, `base_cost`, `currency`, `moq`, `lead_time_days`, `available_quantity`, `updated_at`, `is_active`

**Product detail**
- `GET /products/{id}`
- Same as above + extra media angles + spec fields

**Stock/pricing real-time**
- `GET /products/{id}/availability`
- Returns: `available_quantity`, `lead_time_days`, `backorder_allowed`, `updated_at`

### Optional but strongly recommended
- Webhooks:
  - `product.updated`
  - `product.deactivated`
  - `inventory.updated`
  - `pricing.updated`
- Rate limits + retry headers (`429` + `Retry-After`)

### Normalization contract (what your platform stores)
Normalize both brands into a single internal shape (maps cleanly to `inventory_skus`):
- canonical categories: `ring|necklace|earring|bracelet|pendant|bangle|other`
- normalized metal types and gemstone lists
- a stable image URL for embedding generation

---

## 5) Alibaba Scraping Feasibility + Legal Notes (High Level)

### Feasibility
- **Technically possible**, but **fragile**:
  - aggressive bot detection, CAPTCHA, changing HTML, geo/rate limits
- Real-time “scrape on every buyer upload” risks missing the **<10s** SLA.

### Recommended approach
1) Build an **ingestion pipeline** that periodically collects external items into your own `manufacturer_catalog`:
   - store: title, photos, indicative price range, MOQ, lead time, key attributes, supplier ref (internal-only), and embeddings
2) At request time, only query your normalized dataset (fast + reliable)

### Legal/ToS considerations (non-legal advice)
- Review Alibaba’s Terms of Service / robots.txt and local laws.
- Prefer:
  - Official partner APIs (if available to you), or
  - Licensed data providers / scraping vendors (Zyte/Bright Data/Apify), or
  - Supplier onboarding + direct feeds (best long-term)
- Keep supplier identities **internal-only**, and do not display third-party trademarks/logos externally.

---

## 6) Image Attribute Extraction — Custom vs Pre-trained

### Recommendation
- **Use pre-trained vision LLM for attributes** (Gemini/GPT-4o) + **true image embeddings** for similarity.

### Why not custom first?
- You need labeled datasets for:
  - metal types, gemstone types/colors, setting styles, craftsmanship, etc.
- Collect those labels using:
  - internal ops annotation during quotation review (“human-in-the-loop labels”)

### Success metrics & evaluation
- Attribute extraction: per-field accuracy + “unknown rate”
- Matching: top-1 and top-5 relevance judged by ops/buyers
- Latency: p95 end-to-end time to first results <10s

---

## 7) Development Phases + Timeline (Typical)

Assuming 1–2 full-stack engineers + 1 ops/admin user for feedback:
- **Phase 0 (1 week)**: tighten schema, category enforcement, pricing rules, dashboards “happy path”
- **Phase 1 (2–4 weeks)**: connectors for 2 brand APIs + ingestion to `inventory_skus` + embedding generation jobs
- **Phase 2 (2–6 weeks)**: external catalog ingestion (Alibaba) + normalization + monitoring
- **Phase 3 (ongoing)**: true image embeddings + relevance tuning + UI filters/comparison

---

## 8) Hosting + AI/ML Cost Estimates (Ballpark)

Assumptions for estimates below:
- US region pricing, single environment (prod)
- 100+ concurrent users, but relatively low sustained compute (B2B usage is bursty)
- Catalog sizes: 10k–200k items per source (internal + external)

### Base infrastructure (MVP)
- API + web + dashboard: small containers (2–4 vCPU total) behind a load balancer
- Postgres (with pgvector): 1 medium instance + storage (depends on catalog size)
- Object storage: S3/GCS for images + thumbnails
- Redis (if using BullMQ): small instance

Typical monthly ranges (order-of-magnitude):
- **Compute (API + 2 UIs)**: ~$80–$400/mo (2–4 vCPU, 8–16GB RAM total across 2+ instances/tasks)
- **Load balancer + TLS + bandwidth**: ~$30–$150/mo (varies heavily by traffic/egress)
- **Postgres + pgvector**: ~$120–$700/mo (instance + storage + IOPS; vector-heavy workloads can push IOPS)
- **Redis / queue**: ~$20–$150/mo
- **Object storage**: ~$5–$100/mo (mostly request/egress dependent; storage itself is cheap)

So an MVP production footprint is commonly **~$250–$1,500/mo** excluding AI calls, depending on uptime/SLA and catalog size.

### AI costs
- Vision attribute extraction + embedding per upload:
  - cost scales with uploads/day
  - reduce cost by caching, smaller images, and avoiding double-calls (done in code)

Rule-of-thumb budgeting:
- If you do **1 vision extraction + 1 embedding call per upload**, plan **$0.01–$0.20 per upload** depending on provider/model/resolution.
- Examples:
  - **500 uploads/month**: ~$5–$100/mo
  - **5,000 uploads/month**: ~$50–$1,000/mo
  - **50,000 uploads/month**: ~$500–$10,000/mo

### Practical cost-control levers
- async jobs + early-return “processing” status
- store embeddings once and reuse
- batch inventory embedding generation offline
- add per-account quotas / rate limiting

---

## 9) Immediate “Next Engineering Tasks”

1) Add a proper “external sourcing ingestion” job that populates `manufacturer_catalog`
2) Add a “brand connectors” module:
   - pull catalog + pricing + availability → normalize → upsert into `inventory_skus`
3) Swap embedding approach to a real image-embedding model for stable 0.95 “exact” semantics
4) Add dashboard pages for margin configuration + quotation detail pages
