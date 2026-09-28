# ARCHITECTURE.md: Full-Stack Email Job Scheduler (ReachInbox Assignment)

> Read this whole file before writing any code. It is the source of truth for structure, behavior, and build order.
> Where the Figma design and this file disagree on **layout or copy**, Figma wins. Where Figma is silent (tokens, motion, 3D, states), this file wins.

---

## 0. Agent operating rules

1. Work in the phases in section 14, in order. Finish a phase's acceptance checks before starting the next.
2. TypeScript everywhere, `strict: true`, no `any` without a comment explaining why.
3. **Never** use cron of any kind: no `node-cron`, `agenda`, `setInterval`-as-scheduler, OS cron. Scheduling is BullMQ delayed jobs only. (Instant reject.)
4. Never keep rate-limit or scheduling state in process memory. Redis or Postgres only.
5. No hardcoded limits, delays, concurrency, or secrets. Everything from validated env (`backend/src/config/env.ts`, Zod).
6. Every phase ends with: it runs, tests pass, and a short note appended to `docs/DECISIONS.md` (what was chosen, why, trade-off).
7. Commit small and often with meaningful messages (`feat(worker): atomic hourly rate limit via lua`). The reviewers read git history.
8. All code must be original. Use library docs for API shapes only. Do not copy from other repos or templates.
9. If a requirement is ambiguous, pick the safer interpretation, implement it, and record it in `docs/DECISIONS.md`.

---

## 1. What we are building

A production-style **email scheduler service plus dashboard**:

- A user signs in with Google, uploads a CSV of leads, writes a subject and body, and sets start time, delay between emails, and hourly limit.
- The backend stores everything in Postgres, queues one **BullMQ delayed job per email** in Redis, and sends at the right time through **Ethereal SMTP** using multiple senders.
- It survives restarts, never double-sends, respects per-sender hourly limits by **delaying (never dropping)** overflow into the next hour window, and posts a **real Slack message** when a limit is hit.
- Emails are searchable through **Elasticsearch**. Queue state is visible in **Bull Board**.
- The dashboard shows Scheduled and Sent emails and matches the Figma.

Evaluators care about: correctness under restart and load, idempotency, rate-limit design, code structure, and frontend polish. Optimize for those.

---

## 2. Hard requirements checklist (nothing here may be skipped)

| # | Requirement | Where it lives |
|---|---|---|
| 1 | Schedule emails via API, stored in Postgres | `modules/campaigns` |
| 2 | BullMQ delayed jobs, no cron | `queue/`, `workers/` |
| 3 | Multiple senders via Ethereal SMTP | `integrations/smtp.ts`, `modules/senders` |
| 4 | Survives restart, no duplicates | AOF Redis + DB truth + reconcile-on-boot |
| 5 | Configurable worker concurrency | env `WORKER_CONCURRENCY` |
| 6 | Minimum delay between sends | Redis slot reservation (`MIN_DELAY_MS`) |
| 7 | Hourly limit per sender, Redis-backed, multi-worker safe | Lua script |
| 8 | Overflow is rescheduled to next window, never dropped | worker + `DelayedError` |
| 9 | Slack OAuth connect and live message on limit hit | `modules/slack` |
| 10 | Elasticsearch indexing and search | `integrations/elastic.ts` |
| 11 | Live Bull Board dashboard | `/admin/queues` |
| 12 | Idempotency (same email never sent twice) | 3 layers, section 6 |
| 13 | Google OAuth login, header shows name, email, avatar, logout | frontend + `modules/auth` |
| 14 | Compose: subject, body, CSV upload with count, start time, delay, hourly limit | frontend |
| 15 | Scheduled and Sent tables with loading and empty states | frontend |
| 16 | Handles 1000+ emails at the same time | bulk enqueue + rate logic |
| 17 | README, demo video (max 5 min), private repo shared with `Mitrajit` and `Yadav036` | section 15 |

---

## 3. Tech stack

**Backend:** Node 20+, TypeScript, Express, BullMQ, ioredis, Drizzle ORM (Postgres), Zod, Nodemailer, `@elastic/elasticsearch`, `@bull-board/express`, `google-auth-library`, pino (logging), Vitest + Supertest.

**Database:** PostgreSQL. Neon in production, Docker Postgres locally.

**Queue/cache:** Redis with AOF persistence (Docker locally, Railway in production).

**Search:** Elasticsearch 8 (Docker locally, Elastic Cloud trial in production).

**Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, Radix UI primitives, Framer Motion, `@react-three/fiber` + `@react-three/drei` + `three`, TanStack Query, React Router, React Hook Form + Zod, Papa Parse (CSV), Sonner (toasts).

**Deploy:** Frontend on Vercel. Backend (API + worker + Bull Board) and Redis on Railway. Postgres on Neon. Elasticsearch on Elastic Cloud.

---

## 4. Repository layout

```
/
├── ARCHITECTURE.md
├── README.md
├── docker-compose.yml
├── docs/
│   ├── DECISIONS.md          # running log of choices and trade-offs
│   ├── figma/                # exported Figma screenshots for reference
│   └── architecture.mmd      # Mermaid diagram (also embedded in README)
├── scripts/
│   ├── load-test.ts          # schedules 1000+ emails to show spillover
│   └── restart-demo.md       # exact steps for the demo video
├── backend/
│   ├── package.json
│   ├── drizzle.config.ts
│   └── src/
│       ├── config/env.ts
│       ├── db/{client.ts,schema.ts,migrations/}
│       ├── lib/{redis.ts,logger.ts,crypto.ts,time.ts,errors.ts}
│       ├── queue/{queues.ts,enqueue.ts,reconcile.ts}
│       ├── workers/
│       │   ├── index.ts                 # worker entrypoint
│       │   ├── sendEmail.processor.ts
│       │   ├── indexSync.processor.ts
│       │   └── rateLimiter/{rateLimiter.ts,reserve.lua}
│       ├── integrations/{smtp.ts,slack.ts,elastic.ts,google.ts}
│       ├── modules/
│       │   ├── auth/         # routes, controller, service
│       │   ├── campaigns/
│       │   ├── emails/
│       │   ├── senders/
│       │   ├── slack/
│       │   └── search/
│       ├── middleware/{auth.ts,validate.ts,error.ts}
│       ├── app.ts
│       └── server.ts                    # START_MODE=api|worker|all
└── frontend/
    ├── package.json
    ├── vercel.json                      # rewrites /api/* to the Railway backend
    └── src/
        ├── app/{router.tsx,providers.tsx}
        ├── api/{client.ts,types.ts,hooks/}
        ├── components/
        │   ├── ui/                      # Button, Input, Modal, Table, Tabs, Badge, Skeleton, EmptyState, Toast
        │   ├── layout/{Header.tsx,Shell.tsx}
        │   ├── three/{EnvelopeScene.tsx,FloatingEnvelope.tsx,LaunchEnvelope.tsx,Fallback.tsx}
        │   └── features/{compose,scheduled,sent,slack,limits}/
        ├── pages/{Login.tsx,Dashboard.tsx}
        ├── lib/{csv.ts,format.ts,motion.ts}
        └── styles/{tokens.css,globals.css}
```

`START_MODE=all` runs API and worker in one process (Railway free-tier friendly). `api` and `worker` run them separately.

---

## 5. Data model (Postgres, Drizzle)

```
users
  id uuid pk, google_id text unique, email text unique, name text,
  avatar_url text, created_at timestamptz

senders                      -- Ethereal accounts, seeded per user on first login
  id uuid pk, user_id fk, label text, from_email text,
  smtp_host text, smtp_port int, smtp_user text, smtp_pass_enc text,
  hourly_limit int null,     -- optional per-sender override (<= env cap)
  created_at timestamptz

campaigns
  id uuid pk, user_id fk, subject text, body text,
  start_at timestamptz, delay_ms int, hourly_limit int,
  total_count int, status text, created_at timestamptz

emails
  id uuid pk, campaign_id fk, user_id fk, sender_id fk,
  seq int,                   -- order within campaign, used to keep order on spillover
  to_email text, subject text, body text,
  scheduled_at timestamptz,          -- current planned send time
  original_scheduled_at timestamptz, -- never changes
  status text check in ('scheduled','processing','sent','failed'),
  attempts int default 0, message_id text null, preview_url text null,
  error text null, sent_at timestamptz null, created_at timestamptz,
  unique (campaign_id, to_email)     -- dedupes CSV duplicates and double-submits

slack_connections
  id uuid pk, user_id fk unique, team_name text, channel text,
  webhook_url_enc text, created_at timestamptz
```

Indexes: `emails(status, scheduled_at)`, `emails(user_id, status, scheduled_at)`, `emails(campaign_id)`.
Secrets (`smtp_pass_enc`, `webhook_url_enc`) are AES-256-GCM encrypted with `ENCRYPTION_KEY`.

---

## 6. Core flows

### 6.1 Schedule (POST /api/campaigns)

1. Validate body with Zod: subject, body, start time (future), `delayMs`, `hourlyLimit`, `leads[]` (already parsed by the frontend, re-validated and deduped server-side).
2. In **one transaction**: insert campaign, then insert all email rows in chunks. Assign senders round-robin across the user's senders. `scheduled_at = start + seq * delayMs` (plus small jitter, see 9).
3. **After commit**, `queue.addBulk` in chunks of 500 with `jobId = email.id` and `delay = scheduled_at - now`. Enqueue failure must not lose data: reconcile (6.4) repairs it.
4. Enqueue index-sync jobs for Elasticsearch (best effort, separate queue).
5. Return campaign summary immediately. Never do per-email network calls inside the request.

### 6.2 Worker (per send job)

```
1. Load email + campaign + sender.
   If email.status != 'scheduled'  -> return (already handled)          [idempotency layer 1]
2. Reserve a slot atomically in Redis (Lua, 6.3):
     a. hourly counter for (sender, UTC hour window)
     b. minimum-delay slot for the sender
   Result:
     OK            -> continue
     HOURLY_LIMIT  -> wait = start of next window + seq-based offset
     TOO_SOON      -> wait = time until sender's next free slot
   On HOURLY_LIMIT or TOO_SOON:
     update emails.scheduled_at, then:
        await job.moveToDelayed(Date.now() + wait, token)
        throw new DelayedError()
     On HOURLY_LIMIT only, fire Slack alert once per (sender, window) using Redis SET NX.
3. Claim the row:
     UPDATE emails SET status='processing', attempts=attempts+1
     WHERE id=$1 AND status='scheduled'
   0 rows -> return (another worker won)                                 [idempotency layer 2]
4. Send via Nodemailer using the sender's Ethereal credentials.
5. UPDATE emails SET status='sent', message_id, preview_url, sent_at.
6. Enqueue an index-sync job.
7. On error: rethrow so BullMQ retries with exponential backoff.
   On final failure (attempts exhausted): status='failed', store error, index-sync.
```

BullMQ job options: `jobId = email.id` (layer 3: the queue rejects duplicate ids), `attempts: 3`, `backoff: {type:'exponential', delay: 5000}`, `removeOnComplete: {age: 86400}`, `removeOnFail: false`. Worker options: `concurrency: WORKER_CONCURRENCY`.

Idempotency summary: queue-level `jobId`, DB status check, DB conditional claim. Explain all three in the README.

### 6.3 Rate limiting (Redis Lua, atomic)

Keys:
- `rate:{senderId}:{YYYYMMDDHH}` counter (UTC hour window), TTL 2h.
- `slot:{senderId}` next allowed send time in ms.
- `slacknotified:{senderId}:{YYYYMMDDHH}` NX flag, TTL 2h.

`reserve.lua` receives `limit, minDelayMs, nowMs, windowEndMs` and does, in one atomic script:

```
count = INCR rate key (EXPIRE 7200 on first increment)
if count > limit:    DECR; return {'HOURLY_LIMIT', windowEndMs - nowMs}
next = tonumber(GET slot key) or 0
start = max(next, nowMs)
if start > nowMs:    DECR; return {'TOO_SOON', start - nowMs}
SET slot key (start + minDelayMs)
return {'OK', 0}
```

Effective limit = `min(campaign.hourly_limit, sender.hourly_limit ?? Infinity, MAX_EMAILS_PER_HOUR_PER_SENDER)`. The env value is a hard ceiling. Campaign and sender values operate inside it.

Order preservation on spillover: delayed-to time = `windowEnd + (seq % 1000) * 25ms`, so earlier-seq emails land first in the next window.

Safe across multiple workers and instances because the counter and slot live in Redis and the check-and-update is a single script.

**Behavior with 1000+ emails at once:** rows and jobs are created fast (bulk). Workers process at `WORKER_CONCURRENCY`, the per-sender slot spaces sends by `MIN_DELAY_MS`, and anything over a sender's hourly cap is moved (not failed) to the next window. Document this walk-through in the README with numbers.

### 6.4 Restart safety and reconciliation

- Redis runs with AOF (`appendonly yes`, `appendfsync everysec`) on a persistent volume. BullMQ recovers stalled jobs by itself.
- On API/worker boot, `queue/reconcile.ts` runs once:
  1. Reset stale `processing` rows (older than lock duration plus margin) back to `scheduled`.
  2. Find `scheduled` rows with no matching job (`queue.getJob(id)` is null) and re-add them with the correct remaining delay.
  3. Log counts recovered.
- This makes the system survive a Redis wipe, not just a process restart. Highlight it in the demo and README.
- Graceful shutdown: on SIGTERM/SIGINT, `worker.close()` (waits for in-flight jobs), close queues, redis, db.

### 6.5 Slack

- Slack app scope: `incoming-webhook`. Dashboard "Connect Slack" opens `/api/slack/connect`, which redirects to Slack authorize with a signed `state` (contains user id and expiry).
- Callback exchanges the code (`oauth.v2.access`), stores the returned incoming webhook URL and channel encrypted per user.
- On limit hit: look up the sender's owner's Slack connection. If none, do nothing (no crash, no error). If present, POST to the webhook once per sender per window (NX flag). Message includes sender, limit, window, how many emails were pushed, and the new resume time.
- Connecting later works immediately with no redeploy because the lookup is per event.
- Provide `POST /api/slack/disconnect` and show connection state in the UI.

### 6.6 Elasticsearch

- Index `emails` with: `id, userId, campaignId, to, subject, body, status, scheduledAt, sentAt`.
- Index on create and on every status change through the `index-sync` queue, so an Elasticsearch outage never blocks sending. Retries with backoff.
- `GET /api/emails/search?q=&status=&page=` filters by `userId` always.
- A one-off script `npm run es:reindex` rebuilds the index from Postgres.

### 6.7 Bull Board

Mounted at `/admin/queues` behind HTTP basic auth (`ADMIN_USER`, `ADMIN_PASS`). Shows the `email-send` and `index-sync` queues. Link to it from the dashboard header.

---

## 7. API surface

All under `/api`, JSON, cookie-authenticated except auth routes and health.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness (db, redis, es status) |
| GET | `/auth/google` | start Google OAuth |
| GET | `/auth/google/callback` | finish, set session cookie, redirect to dashboard |
| GET | `/auth/me` | current user |
| POST | `/auth/logout` | clear session |
| POST | `/campaigns` | create campaign and schedule emails |
| GET | `/emails?status=scheduled|sent&page=&pageSize=` | list (sent includes `failed`) |
| GET | `/emails/search?q=&status=` | Elasticsearch search |
| GET | `/senders` | user's senders with current-hour usage |
| GET | `/limits` | per-sender `used/limit/resetsAt` for the UI panel |
| GET | `/slack/connect` | begin Slack OAuth |
| GET | `/slack/callback` | finish Slack OAuth |
| GET | `/slack/status` | connected or not |
| POST | `/slack/disconnect` | remove connection |

Session: signed JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Errors use one shape: `{error:{code,message,details?}}`.

**Cross-domain plan:** avoid third-party cookie problems by proxying. `frontend/vercel.json` rewrites `/api/*` to the Railway URL, so the browser sees one origin. Set `GOOGLE_REDIRECT_URI` and `SLACK_REDIRECT_URI` to the Vercel domain paths (they are proxied). Keep CORS strict as a backup.

---

## 8. Environment variables

`backend/.env.example` must list all of these, documented:

| Var | Purpose |
|---|---|
| `NODE_ENV`, `PORT`, `START_MODE` | runtime |
| `DATABASE_URL` | Postgres |
| `REDIS_URL` | Redis |
| `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY` | search |
| `WORKER_CONCURRENCY` | parallel jobs per worker |
| `MIN_DELAY_MS` | minimum gap between sends per sender |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | hard ceiling |
| `SEND_JITTER_MS` | random offset added when planning send times |
| `JWT_SECRET`, `ENCRYPTION_KEY` | sessions and secret encryption |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI` | Slack OAuth |
| `ADMIN_USER`, `ADMIN_PASS` | Bull Board basic auth |
| `FRONTEND_URL` | CORS and redirects |

Ethereal: at first login, call `nodemailer.createTestAccount()` three times to create three senders per user (or read pre-made ones from env for reproducible demos).

---

## 9. Local infrastructure (docker-compose.yml)

- **redis:** `redis:7`, command `redis-server --appendonly yes --appendfsync everysec`, named volume.
- **postgres:** `postgres:16`, named volume.
- **elasticsearch:** `elasticsearch:8.x`, single-node, security disabled for local, `ES_JAVA_OPTS=-Xms512m -Xmx512m`, memory limit around 1 GB.
- Health checks on all three. Backend `npm run dev` waits for them.

---

## 10. Frontend architecture

- **Routing:** `/login`, `/` (dashboard, protected). Auth state from `/auth/me` via TanStack Query.
- **Dashboard:** header (avatar, name, email, logout, Slack status, Bull Board link), tabs (**Scheduled**, **Sent**), search box (Elasticsearch), primary **Compose New Email** button, and a compact **Sender limits** panel (`used/limit`, reset countdown).
- **Compose modal:** subject, body, CSV/text upload (Papa Parse: trim, dedupe, validate, show "142 valid, 6 invalid"), start time, delay, hourly limit, Schedule. React Hook Form + Zod, disabled states, inline errors.
- **Tables:** Scheduled (email, subject, scheduled time, status) and Sent (email, subject, sent time, status `sent`/`failed`, "View email" link to Ethereal preview). Server-side pagination, skeleton loading, empty state, error state with retry.
- **Data layer:** one typed `api/client.ts`, types in `api/types.ts` shared by hooks and components, query invalidation after scheduling, light polling (10 s) on tables so sends appear live.
- **Components:** all shared UI in `components/ui`, no duplicated table or modal code, `EmptyState` and `Skeleton` reused everywhere.
- **Accessibility:** keyboard focus visible, Radix for dialogs and tabs, color contrast at least AA, `prefers-reduced-motion` respected everywhere.

---

## 11. Visual design system

**Direction:** clean, premium, white. Think precise product UI, not a template. White is the base; one restrained accent; depth comes from soft layered shadows and one memorable 3D moment.

**Tokens (`styles/tokens.css`):**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | page background |
| `--surface` | `#F7F8FA` | subtle panels, table header |
| `--ink` | `#0F1420` | primary text |
| `--ink-muted` | `#5B6474` | secondary text |
| `--line` | `#E6E9EF` | borders and dividers |
| `--accent` | `#3346FF` | primary actions, focus rings, 3D accent |
| `--accent-soft` | `#ECEEFF` | selected/hover tint |
| `--ok` / `--warn` / `--err` | `#12A150` / `#D98A00` / `#D92D20` | status badges |

Radius scale is tiered (inputs 10px, cards 16px, modal 20px), not one radius everywhere. Shadows are layered and low-opacity. No dark mode required.

**Type:** one family, **Geist** (fall back to Inter, system-ui). Clear scale, tight headings, comfortable body line-height, sentence case, no all-caps eyebrow labels. Tabular numbers for counts and times.

**Copy:** plain and action-first. Buttons: "Compose email", "Schedule emails". Empty states tell the user what to do ("No emails scheduled yet. Compose one to get started."). Errors say what happened and how to fix it, without apologizing.

**3D and motion, spent in a few deliberate places:**

1. **Login hero (the memorable moment).** A white, airy `@react-three/fiber` scene: soft-lit envelopes drifting along a curved timeline path toward an "outbox" tray, echoing scheduled sends. Subtle mouse parallax. Accent-blue highlights on the envelope in transit.
2. **Compose success.** When Schedule succeeds, an envelope folds and launches off-screen (3D or CSS 3D transform), then the modal closes and the Scheduled tab updates.
3. **Empty states.** A small idle-floating 3D envelope in place of a flat icon.
4. **Dashboard chrome.** Framer Motion only: shared-layout tab indicator, spring modal open/close, number count-ups on stats, row entrance only for newly arrived rows. Subtle CSS-perspective tilt on the sender-limit cards on hover.

**3D rules (performance and quality):**
- Lazy-load the three.js bundle only on `/login` and when an empty state or launch animation mounts (`React.lazy` + `Suspense`).
- Cap DPR at 1.5–2, keep scenes to a handful of low-poly meshes, no heavy post-processing, `frameloop="demand"` where the scene is idle.
- Provide a static SVG `Fallback` for `prefers-reduced-motion`, no-WebGL, and small/low-power devices. Never block login on 3D.
- Dashboard data tables must never sit behind a 3D canvas or animation.
- Keep motion purposeful: tell the user something changed. No decorative fade-in on every section.

---

## 12. Testing

Vitest + Supertest. Real Redis and Postgres via docker-compose in tests (no mocks for the queue and limiter).

Must-have tests:
1. **Rate limiter:** with limit N, N+1th reservation returns `HOURLY_LIMIT`, counter unchanged after overflow; concurrent calls (e.g. 50 parallel) never exceed N.
2. **Min delay:** two reservations closer than `MIN_DELAY_MS` return `TOO_SOON` with a correct wait.
3. **Idempotency:** two workers processing the same email id result in exactly one send (assert SMTP call count = 1).
4. **Overflow rescheduling:** overflowed emails keep status `scheduled`, get a new `scheduled_at` in the next window, and preserve relative order.
5. **Restart recovery:** delete jobs from Redis, run reconcile, confirm all `scheduled` rows are re-queued once.
6. **Slack:** no connection means no crash and no call; connected means exactly one call per sender per window.
7. **CSV and validation:** invalid, duplicate, and empty leads handled.

Add a GitHub Actions workflow that runs lint, typecheck, and tests with service containers.

---

## 13. Deployment

- **Frontend (Vercel):** root `frontend/`, `vercel.json` rewrites `/api/(.*)` to the Railway backend URL.
- **Backend (Railway):** service from `backend/` with `START_MODE=all`. Redis service with an attached volume and AOF enabled. Public HTTPS domain for callbacks and Bull Board.
- **Postgres:** Neon connection string in `DATABASE_URL` (use the pooled URL for the API).
- **Elasticsearch:** Elastic Cloud trial, URL and API key in env.
- **OAuth setup (do early):** Google Cloud OAuth client and Slack app with redirect URIs pointing to the Vercel domain `/api/...` paths.
- Run migrations on deploy (`drizzle-kit migrate` in the start command or a release step).
- Smoke test on the live URL: Google login, schedule, receive, Slack message, Bull Board.

---

## 14. Build phases and acceptance checks

**Phase 1: Foundation**
Monorepo, docker-compose, env validation, Drizzle schema and migrations, Express skeleton, health endpoint, logger, error middleware.
*Accept:* `docker compose up` then `npm run dev` gives a healthy `/health` (db, redis, es).

**Phase 2: Scheduling core**
Campaign create endpoint, bulk email rows, `addBulk` with `jobId`, worker sends via Ethereal, status updates, preview URLs.
*Accept:* scheduling 20 emails sends them at the right times; Sent rows show preview links.

**Phase 3: Reliability**
Lua rate limiter, min delay, overflow rescheduling, concurrency config, retries and backoff, graceful shutdown, reconcile-on-boot.
*Accept:* limiter tests pass; stopping and restarting mid-run loses nothing and duplicates nothing; wiping Redis and rebooting recovers everything.

**Phase 4: Integrations**
Elasticsearch index-sync and search, Bull Board, Slack OAuth and live notification.
*Accept:* search returns results; Bull Board shows live jobs; hitting a limit posts a real Slack message once per sender per window.

**Phase 5: Auth**
Google OAuth, session cookie, `/auth/me`, logout, per-user data isolation, Ethereal sender seeding at first login.
*Accept:* two different Google accounts see only their own data.

**Phase 6: Frontend**
Design tokens, `components/ui`, login with 3D hero, dashboard shell, tabs, tables with loading and empty states, compose modal with CSV, limits panel, search, toasts, launch animation. Match Figma.
*Accept:* full flow works in the browser; Lighthouse performance is acceptable on login; reduced-motion fallback verified.

**Phase 7: Hardening**
Load-test script (1000+ emails, low hourly limit, shows spillover), full test suite, CI, deploy, live smoke test.
*Accept:* all tests green in CI; live URL works end to end.

**Phase 8: Docs and demo**
README, Mermaid diagram, DECISIONS.md, demo video. See section 15.

---

## 15. Submission checklist

**README must contain:**
- Overview and feature list mapped to backend (scheduler, persistence, rate limiting, concurrency, Slack, Elasticsearch, Bull Board) and frontend (login, dashboard, compose, tables, limits panel)
- How to run backend, worker, frontend, and infra locally
- Ethereal setup and full env table
- Architecture diagram (Mermaid) and the flows from section 6
- **How scheduling works, how restart persistence works, how rate limiting and concurrency work** (state chosen values: concurrency, min delay, hourly cap)
- Idempotency explained (3 layers)
- Behavior under load walk-through (1000+ emails)
- Assumptions, shortcuts, and trade-offs (fixed hourly window vs sliding window, at-least-once delivery with idempotent claim vs true exactly-once, per-sender slot reservation vs BullMQ queue-wide limiter)
- Live URLs (frontend, Bull Board note)

**Repo:** private, collaborators `Mitrajit` and `Yadav036` added, `.env.example` committed, no secrets in git history.

**Demo video (max 5 min), in this order:**
1. Login with Google, show header (name, email, avatar).
2. Compose: upload CSV, show detected count, set delay and hourly limit, Schedule (show the launch animation).
3. Scheduled and Sent tabs updating live; open an Ethereal preview.
4. Bull Board showing delayed jobs.
5. **Restart scenario:** stop the server, start it again, future emails still send on time with no duplicates. Optionally wipe Redis and show reconcile recovering.
6. Rate limit: run the load script with a low hourly limit, show overflow moving to the next window and the Slack message arriving.
7. Search an email through Elasticsearch.

**Form fields:** demo video link (public), repo link, hosted app link, collaborators invited, README updated, not plagiarized.

---

## 16. Non-goals

Do not build: analytics, templates, reply tracking, teams and roles, billing, dark mode. Depth and correctness on the required list beat breadth.
