# DECISIONS.md — Running log of architectural choices and trade-offs

---

## Phase 1 — Foundation (2026-09-28)

### Monorepo structure
**Choice:** npm workspaces with `backend/` and `frontend/` packages at root.
**Why:** Simple, no extra tooling (no Nx, Turborepo). Concurrently runs both dev servers from root.
**Trade-off:** No incremental build caching (acceptable for this project size).

### Database ORM: Drizzle
**Choice:** Drizzle ORM with `drizzle-kit` for migrations, `node-postgres` driver.
**Why:** Type-safe SQL, minimal abstraction, fast query performance, good Postgres feature coverage. Schema is defined in TypeScript and migrations are generated files (auditable in git).
**Trade-off:** Less magic than Prisma; joins require explicit code. Acceptable for a project where we control the schema.

### Env validation: Zod
**Choice:** Zod schema in `config/env.ts`, throws on startup if any var is missing or malformed.
**Why:** Fail-fast on misconfiguration. All business logic reads from the typed `env` object — no `process.env` access elsewhere.
**Trade-off:** Requires all vars to be set even in test. Mitigated by defaulting non-secret vars.

### Encryption: AES-256-GCM
**Choice:** AES-256-GCM for SMTP passwords and Slack webhook URLs stored in Postgres.
**Why:** Authenticated encryption (prevents ciphertext tampering), industry standard, built into Node's `crypto` module.
**Trade-off:** Key rotation requires a migration script (out of scope for this assignment). Key stored as env var — acceptable for demo; a KMS would be used in production.

### Session: JWT in httpOnly cookie
**Choice:** Signed JWT stored in an `httpOnly`, `Secure`, `SameSite=Lax` cookie.
**Why:** Stateless (no server-side session store), works cleanly with the Vercel → Railway proxy (single-origin via rewrites).
**Trade-off:** Cannot invalidate individual tokens (no token blacklist). Mitigated by short expiry (7d) and logout clearing the cookie.

### Redis clients: two separate connections
**Choice:** One `ioredis` client for general use, another for BullMQ.
**Why:** BullMQ requires `maxRetriesPerRequest: null` which blocks the connection — mixing it with general-purpose GET/SET calls would cause timeouts.
**Trade-off:** Two connections to Redis instead of one.

### Rate limiting: Fixed UTC hour window (not sliding)
**Choice:** Hourly limit resets at the UTC hour boundary, not a rolling 60-minute window.
**Why:** Simpler Redis key (YYYYMMDDHH string), deterministic reset time shown in UI, and spillover ordering via `seq % 1000` offset.
**Trade-off:** A sender can send up to 2× the limit if they hit the boundary (limit in last second of hour, then full limit again). This is the common pattern used by email providers and is documented in the README.

### Overflow strategy: rescheduling, never dropping
**Choice:** When HOURLY_LIMIT is returned, the job moves to `delayed` for the next window, never marked failed.
**Why:** Architecture requires it. Any dropped email is a data loss bug.
**Trade-off:** Emails can be delayed by hours under extreme load. The seq-based offset (seq % 1000 × 25ms) preserves relative ordering within the next window.
