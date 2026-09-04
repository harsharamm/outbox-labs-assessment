# ReachInbox Email Scheduler

A production-shaped email scheduler + dashboard: schedule email batches to send at a specific time, backed by BullMQ/Redis persistent delayed jobs (no cron), Postgres for durable state, Ethereal SMTP for sending, Elasticsearch for search, a live BullMQ dashboard, and per-sender hourly rate limiting with Slack alerts.

## Stack

| Layer | Tech |
|---|---|
| Backend | TypeScript, Express, BullMQ, Prisma (Postgres), ioredis, Nodemailer (Ethereal), Elasticsearch, Passport (Google OAuth), Slack OAuth v2 |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Infra | Docker Compose (Postgres, Redis w/ AOF persistence, Elasticsearch) |

## Project layout

```
backend/    Express API + BullMQ worker + Prisma schema
frontend/   Next.js dashboard
docker-compose.yml
```

## 1. Start infrastructure

```bash
docker compose up -d
```

This starts Postgres (`localhost:5432`), Redis with append-only persistence (`localhost:6379`), and a single-node Elasticsearch (`localhost:9200`).

## 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

The API listens on `http://localhost:4000`. The BullMQ worker runs in the same process as the API (see "Architecture" below). The live queue dashboard is at `http://localhost:4000/admin/queues` (requires being logged in — it's gated by the same auth cookie as the API).

### Google OAuth setup
1. Create an OAuth 2.0 Client ID at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) (type: Web application).
2. Authorized redirect URI: `http://localhost:4000/auth/google/callback`.
3. Put the client ID/secret into `backend/.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### Slack OAuth setup
1. Create an app at [api.slack.com/apps](https://api.slack.com/apps) ("From scratch").
2. Under **OAuth & Permissions**, add redirect URL `http://localhost:4000/auth/slack/callback`, and request the `incoming-webhook` and `chat:write` scopes.
3. Put the client ID/secret into `backend/.env` as `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.

### Ethereal SMTP (senders)
Ethereal is a fake SMTP service for testing — no real emails are delivered, but you can view them in a web inbox.
1. Create a free test account at [ethereal.email/create](https://ethereal.email/create).
2. In the dashboard, click **Compose → + Sender** and enter the display name/email plus the SMTP user/password Ethereal gave you.
3. After scheduling, view sent messages at [ethereal.email/messages](https://ethereal.email/messages) (log in with the same SMTP credentials).

## 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3000`, sign in with Google, and you'll land on the dashboard.

---

## Architecture

### Scheduling (no cron)
`POST /api/emails/schedule` parses the uploaded CSV/text file for email addresses, creates one `EmailBatch` row and one `EmailJob` row per recipient (each recipient's `scheduledAt` is spaced `delayMs` apart starting at `startTime`), then bulk-adds a **BullMQ delayed job per recipient** (`queue.addBulk`, `delay = scheduledAt - now`). BullMQ stores delayed jobs in Redis and fires them at the right time — this is the entire "scheduler," no polling loop or cron process involved.

### Persistence across restarts
Redis is started with `--appendonly yes`, so delayed jobs already survive a normal restart on their own. As a belt-and-suspenders safeguard against a *lost* Redis (e.g. a wiped volume), `src/startup/reconcile.ts` runs once on boot: it looks at every `EmailJob` still `SCHEDULED` in Postgres and re-adds it to the queue if it isn't already there — using the DB row's own id as the BullMQ `jobId` means this is a harmless no-op when the job already exists.

### Idempotency (no double sends)
Every `EmailJob.id` doubles as the BullMQ `jobId`. Two effects:
1. BullMQ itself refuses to add a second job with a `jobId` that already exists in the queue — re-scheduling never duplicates.
2. Right before actually sending, the worker does an atomic conditional update: `UPDATE "EmailJob" SET status='PROCESSING' WHERE id=$1 AND status='SCHEDULED'`. Only the worker that gets `rowCount === 1` proceeds to send; every other concurrent attempt (a retry after a crash mid-send, two workers racing on the same job) sees `rowCount === 0` and returns immediately. This is what makes "same email should not be sent more than once" hold even under worker restarts or concurrency.

### Concurrency & the minimum delay between sends
The worker is created with `concurrency = WORKER_CONCURRENCY` (env-configurable) so multiple recipients can be *processed* in parallel (DB lookups, rate-limit checks), but actual sending is throttled globally via BullMQ's built-in limiter: `limiter: { max: 1, duration: MIN_DELAY_MS }`. **We chose a 2 second (`MIN_DELAY_MS=2000`) minimum gap between sends by default** — configurable via env, not hardcoded. This is documented here as a deliberate trade-off: the limiter throttles the whole worker, not per-sender, which is the simplest correct reading of "mimic provider throttling" for a single shared queue.

### Hourly rate limiting (per sender, safe across workers)
Before sending, the worker atomically increments a Redis counter keyed by `rl:<senderId>:<yyyyMMddHH>` (`INCR` + `EXPIRE`). Because `INCR` is atomic, this is safe even with multiple worker processes or instances hitting it concurrently — there's no read-then-write race. If the increment pushes the count over that sender's `hourlyLimit`:
- the increment is immediately reversed (`DECR`) so it doesn't permanently consume a slot,
- the `EmailJob` is reverted to `SCHEDULED` with a new `scheduledAt` at the start of the next hour,
- the BullMQ job itself is moved to delayed via `job.moveToDelayed(nextHourTimestamp)` (never failed or dropped — it stays alive and will be retried),
- and, if the user has connected Slack, a message is sent to their Slack via `notifySlackRateLimit`.

Trade-off: all jobs that overflow the same hour get the same "start of next hour" delay, so relative send order is preserved *approximately* (BullMQ processes delayed jobs primarily by their delay timestamp) but not guaranteed to be perfectly FIFO among that overflow batch. A stricter guarantee would need a per-sender ordered structure (e.g. a Redis sorted set) instead of relying on BullMQ's own delayed-job ordering — out of scope for this assignment but noted as the natural next step.

### Slack notifications
`notifySlackRateLimit` looks up the user's `SlackIntegration` row on every rate-limit hit. If they haven't connected Slack, it's a silent no-op (no crash, no dead-letter). Once they connect (`Connect Slack` in the header → real OAuth authorize flow → we store the incoming-webhook URL from the OAuth response), notifications start working on the very next rate-limit event — no redeploy, since it's just a DB read.

### Elasticsearch
Every `EmailJob` is indexed into an `emails` index at creation (`SCHEDULED`) and re-indexed on every subsequent status change (`SENT`/`FAILED`), scoped by `userId`. `GET /api/emails/search?q=...&status=...` runs a `multi_match` across recipient/subject/body.

### Live BullMQ dashboard
`@bull-board/express` is mounted at `/admin/queues`, wired to the same `Queue` instance the API and worker use, behind the same session cookie auth as the rest of the API.

### Behavior under load (1000+ emails scheduled at once)
Scheduling is O(1) round trips regardless of batch size: one `EmailBatch` insert, one `EmailJob.createMany`, one `queue.addBulk`. The worker's `concurrency` and rate limiter then throttle actual sending — jobs simply queue up as `SCHEDULED`/delayed and drain over time; nothing times out or fails just because a lot was scheduled at once. Elasticsearch indexing on schedule is currently done per-job in a `Promise.all` rather than a bulk `_bulk` call — acceptable for the assignment's scale, called out here as the one place we'd swap in `esClient.bulk()` before pushing this further.

---

## Feature checklist

**Backend**
- [x] Schedule via API, persisted in Postgres
- [x] BullMQ delayed jobs (no cron), per-recipient
- [x] Multi-sender Ethereal SMTP sending
- [x] Elasticsearch indexing + search endpoint
- [x] Live BullMQ dashboard (`/admin/queues`)
- [x] Survives restart without losing/duplicating jobs (reconcile-on-boot + idempotent claim)
- [x] Configurable worker concurrency
- [x] Configurable minimum delay between sends
- [x] Configurable, Redis-backed, multi-worker-safe per-sender hourly rate limit; over-limit jobs reschedule instead of failing
- [x] Real Slack OAuth, live rate-limit notification, safe when disconnected

**Frontend**
- [x] Real Google OAuth login, redirect to dashboard
- [x] Header: name, email, avatar, logout
- [x] Sidebar: Scheduled / Sent tabs with live counts
- [x] Compose modal: subject, body, CSV/text upload with detected-address count, sender picker (+ inline "add sender"), start time, delay, hourly limit
- [x] Scheduled / Sent tables with loading skeletons and empty states
- [x] Toasts for success/error feedback

## Assumptions & trade-offs
- The minimum-delay-between-sends limiter is applied **globally** across the worker rather than per-sender; per-sender delay would need a per-sender BullMQ group, which the open-source version doesn't support natively.
- Elasticsearch indexing at schedule-time is per-document rather than `_bulk`; fine at assignment scale, called out above as the next optimization.
- The BullMQ worker runs in-process with the Express server for simplicity of local setup; splitting it into a separate `node dist/worker.js` process is a one-line change (call `startEmailWorker()` from its own entrypoint) if you want to scale API and workers independently.
- "Senders" are managed with a minimal inline form in the Compose modal (no dedicated settings page) — kept intentionally small since the Figma didn't specify one.
