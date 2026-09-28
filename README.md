# ReachInbox Email Scheduler

A production-style **email scheduler service + dashboard** built as the ReachInbox assignment.

## Quick Start — Cloud Setup

### 1. Provision cloud services (free tiers)

| Service | Provider | Step |
|---|---|---|
| **Postgres** | [Neon](https://neon.tech) | Create project → copy **pooled** connection string |
| **Redis** | [Railway](https://railway.app) | New → Redis → Enable persistent volume → copy URL |
| **Elasticsearch** | [Elastic Cloud](https://cloud.elastic.co) | Free 14-day trial → Create deployment → copy endpoint + API key |

### 2. Configure credentials

Copy `backend/.env.example` to `backend/.env` and fill in:
- `DATABASE_URL` — Neon pooled connection string
- `REDIS_URL` — Railway Redis URL
- `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY` — Elastic Cloud
- `GOOGLE_CLIENT_ID/SECRET` — [Google Cloud Console](https://console.cloud.google.com)
- `SLACK_CLIENT_ID/SECRET` — [Slack API Apps](https://api.slack.com/apps)

### 3. Run migrations

```bash
cd backend
npm run db:migrate
```

### 4. Start the servers

```bash
# Terminal 1 — Backend (API + Worker)
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Visit: http://localhost:5173

Bull Board: http://localhost:4000/admin/queues (user: admin, pass: changeme123)

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE%20(4).md) for the full specification.

### Key flows

**Scheduling:** POST /api/campaigns → Zod validation → DB transaction (campaign + emails) → BullMQ `addBulk` with `jobId=email.id` (idempotency layer 3) → respond immediately.

**Worker:** Load email → check status (layer 1) → Lua rate limit (atomic Redis) → claim row with `WHERE status='scheduled'` (layer 2) → send Nodemailer → mark sent → enqueue Elasticsearch sync.

**Rate limiting:** Atomic Lua script checks hourly counter and per-sender minimum delay slot in one Redis call. Overflow jobs are `moveToDelayed` to next window, preserving seq-based order.

**Restart safety:** On boot, `reconcileQueue()` resets stale `processing` rows and re-enqueues any `scheduled` rows missing from BullMQ.

### Idempotency (3 layers)
1. DB status check (`email.status !== 'scheduled'` → skip)
2. Conditional DB claim (`UPDATE ... WHERE status='scheduled'` → 0 rows → skip)
3. BullMQ `jobId = email.id` → rejects duplicate jobs

---

## Tech Stack

**Backend:** Node 20, TypeScript strict, Express, BullMQ, ioredis, Drizzle ORM, Zod, Nodemailer (Ethereal), @elastic/elasticsearch, @bull-board/express, pino

**Frontend:** React 18, Vite, TypeScript, Radix UI, Framer Motion, @react-three/fiber, TanStack Query, React Hook Form, Papa Parse, Sonner

**Infra:** Neon (Postgres), Railway (Redis), Elastic Cloud (Elasticsearch)
