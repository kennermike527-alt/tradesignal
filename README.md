# tradesignal (SignalForge)

SignalForge is a real-time social intelligence dashboard built on Next.js App Router.

V1 monitors a curated watchlist of X accounts, ingests recent posts on a recurring schedule, deduplicates + stores normalized post data in Postgres, and surfaces short AI summaries explaining why each post matters.

---

## Tech stack

- Next.js (App Router)
- TypeScript
- TailwindCSS
- shadcn/ui-style component system (lightweight local components)
- Prisma + Postgres
- OpenAI API (summary generation)
- Scheduler-friendly ingestion endpoint (`/api/ingest`)

---

## Architecture

```text
src/
  app/
    api/ingest/route.ts       # scheduler/manual HTTP ingestion trigger
    actions.ts                # server action for manual ingestion button
    layout.tsx
    page.tsx                  # dashboard route (/)
  components/
    dashboard/
      dashboard-client.tsx    # filters + post feed UI
      dashboard-header.tsx
      ingestion-runs-panel.tsx
      manual-ingest-button.tsx
      stats-strip.tsx
    ui/
      badge.tsx
      button.tsx
      card.tsx
      input.tsx
      skeleton.tsx
  lib/
    dashboard/queries.ts      # server-side dashboard data loading
    db.ts                     # prisma singleton
    ingestion/ingest-service.ts
    providers/
      index.ts
      mock-x-provider.ts
      social-provider.ts      # provider contract
    summary/summary-service.ts
    types.ts
    utils.ts
  scripts/
    run-ingest.ts             # local CLI ingest run

prisma/
  schema.prisma
  seed.ts
```

### Separation of concerns

- **Provider abstraction** is isolated under `lib/providers`
- **Ingestion pipeline** is under `lib/ingestion`
- **AI summarization** is under `lib/summary`
- **Database access** is centralized in Prisma + `lib/db.ts`
- **Dashboard querying** is in `lib/dashboard/queries.ts`
- **Trigger surfaces** are split between server action (`actions.ts`) and API route (`/api/ingest`)

---

## Data model (Prisma)

### Account
- id
- displayName
- handle
- category
- tags (string array)
- isActive
- provider
- createdAt / updatedAt

### Post
- id
- externalPostId
- provider
- accountId
- content
- postedAt
- sourceUrl
- likeCount / replyCount / repostCount / quoteCount
- fetchedAt
- rawPayload (JSON)
- createdAt / updatedAt

### PostSummary
- id
- postId (unique one-to-one)
- summary
- model
- createdAt / updatedAt

### IngestionRun
- id
- provider
- startedAt / finishedAt
- status (RUNNING/SUCCESS/PARTIAL/FAILED)
- notes
- metadata (JSON)
- createdAt / updatedAt

### Deduplication
Posts are deduplicated by `@@unique([provider, externalPostId])`.

---

## Setup

### 1) Install

```bash
npm install
```

### 2) Environment

Copy `.env.example` to `.env` and set values:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL`
- optional: `OPENAI_API_KEY`
- optional: `OPENAI_MODEL` (default `gpt-4o-mini`)
- `INGESTION_SECRET` (for `/api/ingest` auth in non-dev)

### 3) Database

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

### 4) Run app

```bash
npm run dev
```

Open http://localhost:3000

---

## Ingestion flow

`ingestLatestPosts()` does:

1. create `IngestionRun` in RUNNING state
2. load active accounts
3. call provider `fetchLatestPostsForAccount(account)`
4. normalize + dedupe via `(provider, externalPostId)`
5. insert new posts
6. generate summaries for newly inserted posts only
7. finalize ingestion run with status + metadata

### Manual ingestion

Use the **Run ingestion now** button in dashboard header (server action).

### Scheduler ingestion

Route: `GET/POST /api/ingest`

In production, provide one of:
- `Authorization: Bearer <INGESTION_SECRET>`
- `x-ingestion-secret: <INGESTION_SECRET>`
- query param `?secret=<INGESTION_SECRET>`

This is compatible with Vercel cron or any external scheduler.

---

## Provider abstraction and current status

Current provider implementation is:
- `MockXProvider` (placeholder)

### What is real vs placeholder

- **Real**:
  - account loading
  - ingestion orchestration
  - normalization contract
  - dedupe + persistence
  - summary generation pipeline
  - dashboard UI + filters
  - scheduler route

- **Placeholder**:
  - actual X API/network ingestion source

### Replacing with real X provider

1. Add `real-x-provider.ts` implementing `SocialIngestionProvider`
2. Implement authenticated fetch logic in `fetchLatestPostsForAccount`
3. Return normalized `NormalizedSocialPost[]`
4. Swap selection in `lib/providers/index.ts`

No dashboard or ingestion service rewrite required.

---

## AI summary behavior

Service: `src/lib/summary/summary-service.ts`

- Uses OpenAI when `OPENAI_API_KEY` is present
- Generates 1-2 sentence “why this matters” summaries
- Does **not** regenerate existing summaries during ingestion
- Uses fallback heuristic summary if OpenAI is unavailable

Prompt is centralized and easy to tune.

---

## V1 feature checklist

- [x] Watchlist seed (15 accounts)
- [x] Provider abstraction
- [x] Ingestion pipeline with run tracking
- [x] Deduped normalized post storage
- [x] AI summary service layer
- [x] Dashboard with filters
- [x] Manual ingestion trigger
- [x] Scheduler-compatible `/api/ingest`
- [x] Typed modular architecture

---

## Known limitations (V1)

1. X ingestion provider is mock (placeholder architecture only).
2. Dashboard filtering is client-side over loaded records (fine for V1; paginate for scale).
3. No auth layer yet (internal tool assumption).
4. No retry/backoff queue for provider failures yet.
5. No background job queue for summary generation spikes.

---

## Recommended V2

1. **Real provider integration**
   - official API or trusted ingestion backend
   - provider health + retry/backoff + circuit breaker

2. **Job queue + worker split**
   - ingestion and summary generation decoupled (e.g., QStash/Trigger.dev/BullMQ)

3. **Auth and role controls**
   - SSO/internal auth for manual trigger and admin controls

4. **Pagination + server-side filters**
   - reduce payload, speed up large datasets

5. **Entity/topic extraction**
   - tags from content, sentiment, narrative clusters

6. **Multi-provider expansion**
   - Telegram/Discord/RSS/Farcaster via same provider contract

7. **Observability**
   - structured logs, run metrics, alerting on ingestion failures

---

## Quick start commands recap

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Manual one-off ingestion from CLI:

```bash
npm run ingest:once
```
