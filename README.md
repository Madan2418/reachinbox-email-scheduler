# ReachInbox Email Scheduler

A high-performance, resilient, and production-ready **Email Scheduling Service & Dashboard** built for ReachInbox. Features distributed scheduling with BullMQ, Redis-backed rate limiting, database-backed crash recovery, Elasticsearch full-text search, and a modern, responsive web dashboard.

---

## Table of Contents

- [Live Deployment](#live-deployment)
- [System Architecture](#system-architecture)
  - [Architecture Diagram](#architecture-diagram)
  - [How Scheduling Works](#how-scheduling-works)
  - [Persistence & Restart Safety](#persistence--restart-safety)
  - [Rate Limiting & Concurrency](#rate-limiting--concurrency)
  - [3-Layer Idempotency](#3-layer-idempotency)
- [Features Implemented](#features-implemented)
  - [Backend Features](#backend-features)
  - [Frontend Features](#frontend-features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Environment Configuration](#1-environment-configuration)
  - [2. Ethereal Email Setup](#2-ethereal-email-setup)
  - [3. Running Migrations](#3-running-migrations)
  - [4. Running the Backend](#4-running-the-backend)
  - [5. Running the Frontend](#5-running-the-frontend)
- [Bull Board Monitoring](#bull-board-monitoring)
- [API Reference](#api-reference)
- [Tech Stack](#tech-stack)

---

## Live Deployment

🌐 **Live Application**: [https://reachinbox-email-scheduler-zeta-sepia.vercel.app/](https://reachinbox-email-scheduler-zeta-sepia.vercel.app/)

---

## System Architecture

### Architecture Diagram

```
                 ┌──────────────────────────────────────────────┐
                 │             React + Vite Frontend             │
                 │   (Google OAuth, Compose Modal, Dashboard)   │
                 └──────────────────────┬───────────────────────┘
                                        │ HTTP / REST
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Express Backend API                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  PostgreSQL (Drizzle ORM)            │  Redis (BullMQ Engine)               │
│  - Users, Senders, Campaigns, Emails │  - Delayed Email Queue               │
│  - Source of Truth & Statuses        │  - Atomic Lua Rate Limiting Keys     │
└──────────────────┬───────────────────┴──────────────────┬───────────────────┘
                   │                                      │
                   ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BullMQ Email Worker                               │
│  - Concurrency: 5 jobs                                                      │
│  - Reconciler: Recovers stuck jobs on boot                                  │
│  - Atomic Token Bucket / Delay Slots via Redis Lua                          │
└──────────────────┬──────────────────────────────────────┬───────────────────┘
                   │                                      │
                   ▼                                      ▼
      ┌─────────────────────────┐            ┌────────────────────────┐
      │     Nodemailer SMTP     │            │     Elasticsearch 8    │
      │  (Ethereal Email Test)  │            │  (Full-text indexing)  │
      └─────────────────────────┘            └────────────────────────┘
```

---

### How Scheduling Works

1. **Campaign Creation**:
   - The user fills out the Compose form with email subject, message body, start time (`startAt`), per-email delay (`delayMs`), and hourly limit.
   - The user uploads a CSV file of leads containing `email` and optional `name` columns. The client parses and validates rows using **PapaParse**.
   - A single `POST /api/campaigns` request is dispatched to the backend.

2. **Database Transaction**:
   - The backend validates the payload with **Zod**.
   - Within an atomic PostgreSQL transaction:
     - The `campaign` record is created.
     - Email records are batch-inserted into `emails` with status `'scheduled'`, associated sender IDs (distributed round-robin across available user senders), and computed `scheduled_at` timestamps with optional jitter to avoid thundering-herd spikes.

3. **Job Enqueuing (BullMQ)**:
   - For each scheduled email, a BullMQ job is added to `email-queue` in bulk (`addBulk`).
   - The delay is calculated as `max(0, scheduledAt - now)`.
   - Each job is assigned a deterministic `jobId = email.id`, ensuring duplicate jobs are rejected by BullMQ if re-submitted.
   - The API responds immediately with scheduled counts.

4. **Execution & Delivery**:
   - Once the delay elapses, a worker process picks up the job.
   - The worker executes the rate limiter (see below) and sends the message using **Nodemailer** over SMTP.
   - Upon successful delivery, the status is updated to `'sent'`, the `sent_at` timestamp and Ethereal `preview_url` are persisted, and the email is indexed into **Elasticsearch**.

---

### Persistence & Restart Safety

If the server crashes, power drops, or restarts during scheduled sends:

1. **PostgreSQL as Source of Truth**:
   - Every email has an explicit status in Postgres (`scheduled`, `processing`, `sent`, `failed`).
2. **Startup Queue Reconciler (`reconcileQueue`)**:
   - When the backend boots, the reconciler automatically executes:
     - **Stale Processing Recovery**: Any emails lingering in `'processing'` status (worker died mid-execution) are automatically rolled back to `'scheduled'`.
     - **Missing Job Re-hydration**: The reconciler queries all emails with `status = 'scheduled'`. If an email is not present in BullMQ's waiting or delayed sets (e.g. if Redis lost unpersisted memory), the job is re-added with its remaining delay recalculated against `scheduled_at`.
3. **Redis AOF**:
   - Redis Append-Only File (AOF) persistence preserves job queues across process restarts.

---

### Rate Limiting & Concurrency

Rate limiting protects sender reputation and prevents triggering provider blocks:

1. **Worker Concurrency**:
   - Configured via `WORKER_CONCURRENCY=5`. Up to 5 worker threads execute parallel deliveries across distinct sender pools.
2. **Atomic Lua Rate Limiting (`rate_limiter.lua`)**:
   - Rate limits are verified in a single, atomic Redis Lua evaluation to eliminate race conditions between concurrent worker threads:
     - **Hourly Quota**: Increments a key `rate:sender:{senderId}:hour:{YYYYMMDDHH}` with a 1-hour TTL. If the counter exceeds the hourly cap (`hourlyLimit` or `MAX_EMAILS_PER_HOUR_PER_SENDER`), the job is rescheduled via BullMQ's `moveToDelayed` to the beginning of the next UTC hour.
     - **Delay Slot Reservation**: Ensures at least `delayMs` (default: 1000ms) has elapsed since the last email sent from this specific sender. If the sender sent an email too recently, the current job is delayed by the remainder of the interval.

---

### 3-Layer Idempotency

Prevents duplicate email deliveries under any retry or network failure condition:

| Layer | Mechanism | Action on Failure / Duplicate |
|---|---|---|
| **Layer 1: Memory Check** | Before execution, worker checks `email.status !== 'scheduled'` | Skips immediately without sending |
| **Layer 2: Atomic DB Claim** | `UPDATE emails SET status = 'processing' WHERE id = ? AND status = 'scheduled'` | If `rowsAffected === 0`, another worker grabbed it; exits |
| **Layer 3: BullMQ Job ID** | `jobId = email.id` | Redis/BullMQ rejects duplicate job insertions |

---

## Features Implemented

### Backend Features
- **REST API**: Built with Node 20, TypeScript, Express, and Zod schema validation.
- **Database Layer**: PostgreSQL via **Drizzle ORM** with migrations and relation mappings (`users`, `senders`, `campaigns`, `emails`).
- **Distributed Queuing**: **BullMQ** on Redis with delayed job support and bulk scheduling.
- **Worker Pipeline**: Multi-worker background processor with graceful shutdown (`SIGTERM`/`SIGINT`).
- **Fault Recovery Reconciler**: Automatic startup reconciliation of interrupted jobs.
- **Atomic Lua Rate Limiter**: Per-sender hourly limit and minimum inter-email delay.
- **Credential Encryption**: Sender SMTP passwords stored using **AES-256-GCM** with per-user authentication keys.
- **SMTP Sandbox**: Integrated with **Nodemailer** + **Ethereal Email** test accounts.
- **Elasticsearch 8**: Full-text email search, index lifecycle setup, and real-time indexing on send.
- **Google OAuth 2.0**: Secure authentication issuing signed JWT cookies.
- **Slack Integration**: Webhook notification dispatch on campaign completion.
- **Queue Admin Dashboard**: Bull Board mounted at `/admin/queues` protected with HTTP Basic Auth.

### Frontend Features
- **Design System**: Tailored, modern white/slate theme with glassmorphic cards and crisp contrast.
- **Micro-Animations**: Custom SVG flying envelopes with Framer Motion animations.
- **Authentication**: Seamless Google Sign-In with automatic sender account provisioning.
- **Live Metrics Dashboard**:
  - Total sent, scheduled, and failed count badges.
  - Active sender quota progress bars with live countdown timers until reset.
- **Compose Campaign Modal**:
  - True Flexbox-centered modal with persistent action buttons.
  - Client-side CSV drag-and-drop parser (**PapaParse**) with instant row validation and duplicate filtering.
  - Subject, body, datetime-local picker, delay configuration, and hourly rate limit sliders.
- **Scheduled & Sent Tables**:
  - Filter by status (`scheduled` vs. `sent`).
  - Real-time background data synchronization via **TanStack Query**.
  - **Live Web Preview**: Direct link to open sent messages in the Ethereal web inbox viewer.
- **Full-Text Search**: Instant email query bar powered by Elasticsearch.
- **Slack Connection**: Direct OAuth connect button for Slack notifications.

---

## Getting Started

### Prerequisites
- **Node.js**: v20 or higher (`node -v`)
- **npm**: v9 or higher
- **PostgreSQL**: Local instance or cloud database (e.g., [Neon](https://neon.tech))
- **Redis**: Local instance or cloud Redis (e.g., [Railway](https://railway.app), [Upstash](https://upstash.com))
- **Elasticsearch 8**: Local instance or [Elastic Cloud](https://cloud.elastic.co) (optional for full-text search)

---

### 1. Environment Configuration

Copy the sample environment file in `backend/`:

```bash
cd backend
cp .env.example .env
```

Configure the following variables in `backend/.env`:

```ini
# Application
NODE_ENV=development
PORT=4000
START_MODE=all
FRONTEND_URL=http://localhost:5173

# Database & Redis
DATABASE_URL=postgresql://reachinbox:reachinbox@localhost:5432/reachinbox
REDIS_URL=redis://localhost:6379

# Elasticsearch (optional for search)
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_API_KEY=

# Worker Settings
WORKER_CONCURRENCY=5
MIN_DELAY_MS=1000
MAX_EMAILS_PER_HOUR_PER_SENDER=100

# Security (Generate random keys)
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

# Bull Board Credentials
ADMIN_USER=admin
ADMIN_PASS=changeme123
```

> **Generating Encryption Key**:
> Run in terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

### 2. Ethereal Email Setup

**Zero manual setup required!**
The application is pre-configured to use **Ethereal Email** (Nodemailer's safe SMTP testing sandbox).

- When a new user logs in via Google, the backend **automatically generates 3 dedicated Ethereal test accounts** using `nodemailer.createTestAccount()`.
- The credentials are encrypted with AES-256-GCM and stored in PostgreSQL.
- Emails sent through Ethereal are real SMTP deliveries, but safe: they do not deliver to real inboxes, avoiding spam penalties during development.
- **Viewing sent emails**: In the dashboard, click the **"Sent"** tab and click **"View"** next to any sent email to inspect the formatted message in Ethereal's web viewer.

*(To switch to real SMTP providers like Gmail, SendGrid, or SES in production, simply update the records in the `senders` table with your actual SMTP host, port, username, and password).*

---

### 3. Running Migrations

Apply the database schema to your PostgreSQL instance:

```bash
cd backend
npm run db:migrate
```

---

### 4. Running the Backend

Start the API and BullMQ worker:

```bash
cd backend
npm run dev
```

The backend server boots on `http://localhost:4000`.

---

### 5. Running the Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open your browser at: **`http://localhost:5173`**

---

## Bull Board Monitoring

A built-in BullMQ dashboard is available to inspect jobs, review failed attempts, and view queues in real time:

- **URL**: `http://localhost:4000/admin/queues`
- **Username**: `admin` (or value of `ADMIN_USER`)
- **Password**: `changeme123` (or value of `ADMIN_PASS`)

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/google` | Initiates Google OAuth 2.0 login flow |
| `GET` | `/api/auth/me` | Returns the currently authenticated user profile |
| `POST` | `/api/auth/logout` | Clears authentication session cookie |
| `POST` | `/api/campaigns` | Validates leads, schedules campaign & enqueues BullMQ jobs |
| `GET` | `/api/campaigns` | Lists all campaigns created by the user |
| `GET` | `/api/emails` | Retrieves paginated list of scheduled/sent emails |
| `GET` | `/api/senders` | Returns configured senders and active hourly limits |
| `GET` | `/api/search` | Full-text search across emails via Elasticsearch |
| `GET` | `/health` | Service health check |

---

## Tech Stack

| Domain | Technologies |
|---|---|
| **Backend** | Node.js 20, TypeScript, Express, Drizzle ORM, Zod, Nodemailer, Pino |
| **Queue & Scheduling** | Redis, BullMQ, Lua Scripting |
| **Database** | PostgreSQL (Neon / Local) |
| **Search Engine** | Elasticsearch 8 |
| **Frontend** | React 18, Vite, TypeScript, TanStack Query, Framer Motion, Radix UI, PapaParse, Sonner |
| **Testing & Tooling** | Ethereal Email, Bull Board, tsx |
