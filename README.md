# tradesignal // SignalForge Terminal

`tradesignal` is a **real-time social intelligence terminal** for monitoring narrative shifts and making engagement decisions.

This is not an admin panel and not a KPI-first dashboard. The core object is the live feed of posts/signals:

- what changed
- why it matters
- what deserves action
- who to engage with

---

## Product direction (V1.5)

### Information hierarchy

1. **Top command bar**
   - system mode (LIVE/DEMO)
   - database state
   - provider/source status
   - refresh cadence
   - manual ingest action

2. **Left command sidebar**
   - watchlists
   - narrative filters
   - saved-view shortcuts

3. **Main center feed (dominant surface)**
   - dense, scrollable post intelligence cards
   - account/category/time/content/engagement/source
   - AI "Why this matters"
   - tactical affordances: save / assign / tag

### Multi-dashboard routing

- Primary center tabs: **IOTA** and **TWIN**
- Source tabs inside each center: **X** and **LinkedIn**
- Network constellation is center-specific; each center dashboard has its own constellation.
- Center assignment is strict keyword policy:
  - **IOTA** only when content includes: `iota`, `@iota`, `#iota`, or `iota cash stack`
  - **TWIN** only when content includes: `twin foundation`, `@twinfoundation`, `#twinfoundation`, or `twinfoundation`

4. **Right intelligence sidebar**
   - AI narrative command layer (24h / 3d windows)
   - emerging narratives (cluster summaries)
   - key topics (filtered terms excluding baseline tokens)
   - engage-now actions (derived from engagement angles)
   - high-velocity support + ingestion run status

---

## Technical stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Local UI primitives (shadcn-style)
- Prisma + PostgreSQL
- OpenAI summaries (optional) + deterministic fallback

---

## Current architecture

```text
src/
  app/
    api/ingest/route.ts
    actions.ts
    page.tsx
    layout.tsx
    error.tsx
  components/
    dashboard/
      dashboard-client.tsx
      manual-ingest-button.tsx
    ui/
      badge.tsx button.tsx card.tsx input.tsx skeleton.tsx
  lib/
    db.ts
    types.ts
    utils.ts
    runtime/db-health.ts
    dashboard/
      queries.ts
      demo-payload.ts
    ingestion/ingest-service.ts
    providers/
      social-provider.ts
      mock-x-provider.ts
      index.ts
    summary/summary-service.ts
    summarization/
      context-summarization-service.ts
    context/
      context-resolver.ts
  scripts/
    db-setup.ts
    db-status.ts
    run-ingest.ts

prisma/
  schema.prisma
  migrations/
    0001_init/migration.sql
  seed.ts
```

---

## Environment setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL`

Optional:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `INGESTION_SECRET`
- `CONTEXT_SUMMARY_PROVIDER` (`openai` | `heuristic`)
- `CONTEXT_SUMMARY_MODEL`
- `CONTEXT_SUMMARY_REFRESH_MINUTES`
- `CONTEXT_SUMMARY_MAX_POSTS`

Budget guard (recommended defaults for ~$350/month target):

- `INGEST_MONTHLY_BUDGET_USD=350`
- `INGEST_CADENCE_MINUTES=60`
- `INGEST_POST_READ_COST_USD=0.005`
- `INGEST_USER_READ_COST_USD=0.01`
- `INGEST_EST_POSTS_PER_ACCOUNT_PER_RUN=10`
- `INGEST_EST_USER_READS_PER_ACCOUNT_PER_RUN=0`

### How the $ cap works

Runtime estimator computes:

- `estimatedCostPerRun = activeAccounts * ((postsPerAccount * postReadCost) + (userReadsPerAccount * userReadCost))`
- `projectedMonthlyCost = estimatedCostPerRun * (30 * 24 * 60 / cadenceMinutes)`

If `projectedMonthlyCost > INGEST_MONTHLY_BUDGET_USD`, ingestion is blocked with:

- `BUDGET_GUARD_BLOCK`

The response includes:

- projected monthly cost
- current cadence
- minimum safe cadence required to stay under budget

---

## Database setup (robust flow)

### 1) Check configuration

```bash
npm run db:status
```

If `DATABASE_URL` is missing or DB is unreachable, this command exits with friendly guidance.

### 2) Full setup (recommended)

```bash
npm run db:setup
```

This runs:

1. `prisma generate`
2. `prisma migrate deploy`
3. `prisma db seed`

### 3) Start app

```bash
npm run dev
```

Open: `http://localhost:3000`

---

## Migrations and seed behavior

- Baseline migration is committed at `prisma/migrations/0001_init`.
- Watchlist account migration: `prisma/migrations/0002_watchlist_accounts`.
- Context summary storage migration: `prisma/migrations/0003_context_summaries`.
- Seed script can be used for local smoke testing, but production/live dashboards are intended to run in **live-only mode**.
- No curated fallback account list is injected into runtime dashboard views.

---

## Context summarization service (AI command layer)

The reusable service lives at:

- `src/lib/summarization/context-summarization-service.ts`

It performs:

1. Context-scoped post selection (center + platform + window)
2. Topic clustering (keyword baseline)
3. AI structured summarization (OpenAI by default, heuristic fallback)
4. Storage in `ContextSummary` table
5. Cache reuse: does not regenerate if a recent summary exists for same context+window (unless forced refresh)

### Prompt template (exact)

The model receives this strict prompt structure (template version `v1`):

- role: operations-focused social intelligence analyst
- constraints:
  - no platform comparisons
  - no fluff
  - ignore baseline labels as topic names
  - strict JSON output
- context block:
  - center
  - platform
  - time window
  - pre-extracted key topics
- schema block requiring:
  - `global_summary`
  - `topics[]` with `topic_name`, `summary`, `tone`, `why_it_matters`, `engagement_angles`, `respond_to_handles`, `key_terms`, `post_count`
- cluster input payload with representative posts/terms/handles

Use `getContextSummaryPromptPreview()` to inspect active provider/model/config at runtime.

---

## Runtime behavior and failure handling

### Controlled error handling (no raw infra dumps)

When DB is not configured/reachable:

- the app switches to **DEMO mode**
- shows controlled status messaging in command bar
- serves an empty live-only fallback state from `lib/dashboard/demo-payload.ts` (no curated account injection)

Manual/API ingestion returns controlled messages/codes:

- `DB_URL_MISSING`
- `DB_UNREACHABLE`
- `INGESTION_FAILURE`
- `BUDGET_GUARD_BLOCK`

When `BUDGET_GUARD_BLOCK` triggers, ingestion is blocked until cadence/scope is adjusted to stay under budget.

Implementation references:

- `src/lib/ingestion/budget-guard.ts` (budget math + minimum cadence)
- `src/lib/ingestion/ingest-service.ts` (pre-run blocker + run metadata)
- `src/app/actions.ts` (manual action message)
- `src/app/api/ingest/route.ts` (API response code/message)

No raw Prisma stack traces are surfaced in the main UI.

---

## Ingestion endpoints

- Manual: command bar "Run ingest"
- API: `GET/POST /api/ingest`

Auth (non-development):

- `Authorization: Bearer <INGESTION_SECRET>`
- OR `x-ingestion-secret: <INGESTION_SECRET>`
- OR `?secret=<INGESTION_SECRET>`

---

## Vercel deployment

### Required env vars in Vercel project

- `DATABASE_URL`
- `INGESTION_SECRET`

Optional:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

After setting env vars, redeploy.

---

## What is fully functional vs placeholder

### Fully functional

- terminal layout + information hierarchy
- watchlists/filters/toggles
- post intelligence cards + action affordances
- controlled runtime status system
- Prisma schema/migration/seed pipeline
- ingestion orchestration shell
- API + manual trigger surface

### Placeholder / mocked

- real X API ingestion source
  - current provider: `MockXProvider`
  - isolated under `src/lib/providers`
  - can be replaced without redesigning terminal UI

---

## Quick command reference

```bash
npm install
npm run db:status
npm run db:setup
npm run dev
```

Optional one-shot ingest:

```bash
npm run ingest:once
```

---

## Account-led intelligence pivot (current)

TradeSignal is now account-led by design:

- primary object: tracked accounts
- first question: what tracked accounts are discussing
- second question: who engages with those tracked accounts and what else they care about

### New/extended data model

- `TrackedAccount`
- `PostClassification`
- `EngagingAccount`
- `EngagementEvent`
- `EngagerInterestProfile`
- `InterestCluster`
- `TopicSummary`
- `ActionableSignal`

### Provider capability honesty

The dashboard includes provider capability notes (X vs LinkedIn) and does not claim unsupported engagement types as complete.

### Current limitations

- Engagement event ingestion depth depends on provider endpoint access.
- Adjacent-interest inference is strongest when engager activity is available; otherwise the panel degrades gracefully.
- Topic clustering is currently a practical baseline + LLM summary layer, not full semantic embedding clustering yet.
