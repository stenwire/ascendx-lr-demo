# AscendX Leave Requests
> https://ascendx-lr-demo.onrender.com/

Working implementation of the section 2 engineering task from the take-home assessment:
employees submit leave requests, managers approve/reject them, and an AI assistant drafts
a friendly approval message. Design rationale, trade-offs, and the deferred-feature list
live in [`assessment_responses/02_engineering_task.md`](assessment_responses/02_engineering_task.md);
this README covers how to run what's here.

## Stack

- **Backend:** Node.js + TypeScript, Express, Prisma/Postgres
- **AI:** Google ADK (`@google/adk`, adk-js) + Gemini, with an offline mock mode as the default
- **Frontend:** React + TypeScript (Vite), React Router, Tailwind CSS v4

## Prerequisites

- Docker (for the fully-dockerized path below), and/or
- Node.js 20+ (for running server/client directly on the host)

## Setup

The whole app — Postgres, the API, and the frontend — is dockerized
(`docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile`). Source is bind-mounted
into the containers, so edits on the host hot-reload inside them same as running locally.

```bash
cp server/.env.example server/.env   # only needed if you want to set AI_MODE=live later
docker compose up -d --build         # postgres, server (:4000), client (:5173)
docker compose exec server npm run seed   # once, seeds a 4-person "support" team
```

Or with the Makefile: `make up` then `make docker-seed`.

Open `http://localhost:5173`. The "Viewing as" dropdown stands in for real login (see
**Simplifications** below) — pick an employee to submit leave, or the manager to see the
approval queue.

### Running on the host instead

If you'd rather run the server/client directly on the host (e.g. for a debugger) and only
put Postgres in Docker:

```bash
docker compose up -d postgres        # or: make up-db

cd server
cp .env.example .env
npm install
npm run prisma:migrate   # creates tables
npm run seed              # seeds a 4-person "support" team (1 manager + 3 reports)
npm run dev                # http://localhost:4000

# Frontend (separate terminal)
cd client
npm install
npm run dev                # http://localhost:5173
```

### Using the Makefile

A `Makefile` in this directory wraps both workflows. Run `make help` for the full list;
common ones:

```bash
make up             # build + start the whole stack in Docker (postgres, server, client)
make up LOGS=1      # same, then immediately attach and stream logs (Ctrl+C to detach)
make docker-seed    # seed the dockerized database (run once)
make logs           # tail logs for all containers (interleaved)
make logs-server    # tail logs for just the server container
make logs-client    # tail logs for just the client container
make logs-postgres  # tail logs for just the postgres container
make down           # stop containers (data volume is kept)

make up-db          # start only Postgres, for the host-based workflow below
make install        # npm install in both server and client
make migrate        # run Prisma migrations
make seed           # seed sample employees (host workflow)
make dev-server     # backend dev server on the host, http://localhost:4000
make dev-client     # frontend dev server on the host, http://localhost:5173
make test           # create the test db (if needed) and run the server test suite
make build          # production build of server and client
make db-shell       # psql shell into the running Postgres container
```

## Frontend

A dashboard-style app shell — dark sidebar, light workspace — with each action on its
own route:

| Route | Screen | Access |
|---|---|---|
| `/` | Overview — stat tiles and recent requests | all |
| `/requests` | My requests — table with status filters | all |
| `/requests/new` | New request form | all |
| `/requests/:id` | Request detail — history, approval message, regenerate | all |
| `/approvals` | Pending queue with the staffing warning inline | manager |
| `/team` | Team availability timeline | manager |
| `/account` | Profile and the employee id used for API calls | all |
| `/help` | AI/offline modes, guardrails, design decisions | all |

Manager-only routes are hidden from the sidebar and redirect to `/` for non-managers.
The account menu in the top bar doubles as the "sign in as" switcher (see
**Simplifications**) and persists across reloads, so deep links keep the selected user.

**Responsive:** tables collapse to stacked cards below `sm`, the sidebar becomes a drawer
below `lg`, and the account menu stays reachable at every width.

**Walkthrough:** a short guided tour runs on first visit and can be replayed from
**How it works**. It's a custom spotlight overlay — no tour dependency — with arrow-key
navigation and Escape to leave. Manager-only stops are dropped for employees.

**Design tokens** live in `client/src/index.css` under Tailwind v4's `@theme` block — the
brand color is `#00BCFF`. Because that value only reaches ~2.2:1 against white, it is used
for accents, active states, and the dark sidebar; a darkened shade (`brand-700`, `#007EAD`)
carries text and primary buttons on light surfaces so everything clears WCAG AA.

**Team availability** (`/team`) draws a 30-day strip of who is away and flags the days
where coverage would fall below the same threshold the server's staffing rule uses, so a
manager can see a warning coming before they act. It fans out one request per direct
report because the API has no team-scoped list endpoint — fine at this size, noted as a
trade-off rather than worked around.

## Deploying

`Dockerfile.prod` builds a **single container** that runs the whole app: the frontend is
compiled to static files and served by the API from the same origin, so there is one
service and one port. Migrations run before the server accepts traffic, and seeding is a
no-op once the team exists, so a restart never destroys data.

```bash
docker build -f Dockerfile.prod -t ascendx-lr .
docker run -p 8000:8000 -e DATABASE_URL="postgresql://…" ascendx-lr
```

### The database is not part of the image

`docker-compose.yml` runs Postgres for local development only. The production image
contains the app and nothing else, so a hosted deployment needs a Postgres instance of
its own — Render Postgres, Koyeb Managed Postgres, Neon, Supabase, or anything Postgres 16.

Point `DATABASE_URL` at that instance. Copying the value out of `server/.env` will not
work: inside a container `localhost` is the container itself, so Prisma fails at boot with

```
Error: P1001: Can't reach database server at `localhost:5432`
```

Most managed providers require TLS, so append `?sslmode=require` unless the provider's
own connection string already includes it:

```
postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
```

On Render, prefer the **Internal Database URL** when the database and service share a
region — it skips the public internet and needs no `sslmode`. Use the External URL, with
`sslmode=require`, from anywhere else.

#### Supabase: use the pooler, not the direct connection

Supabase's direct host, `db.<project-ref>.supabase.co`, resolves to an **IPv6 address
only**. Most hosts — Render included — have no IPv6 egress, so a container cannot route
to it and Prisma reports `P1001` even though the credentials are correct.

Use the **session pooler** instead, which is reachable over IPv4. Its connection string
differs from the direct one in two places: the host, and the username, which gains the
project ref.

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Copy the exact value from **Project Settings → Database → Connection string → Session
pooler**; the region prefix varies per project.

Stay on port **5432**, the session pooler. The transaction pooler on 6543 does not support
the advisory locks `prisma migrate deploy` takes out, so migrations can hang or fail
there. Transaction pooling needs `?pgbouncer=true` plus a separate `directUrl` for
migrations, which this app does not set up.

Environment variables:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres 16 from a managed provider, never `localhost` |
| `PORT` | no | Defaults to `8000`. Most platforms inject this automatically. |
| `AI_MODE` | no | `mock` (default) or `live` |
| `GEMINI_API_KEY` | only for `live` | Falls back to `mock` when unset |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest` |
| `STAFFING_MIN_AVAILABLE_RATIO` | no | Defaults to `0.5` |
| `SEED_FORCE` | no | `true` resets the demo data back to the seeded team |

### Koyeb

Build from the Dockerfile and leave every override **off** — the image already sets its
own working directory, entrypoint and command:

| Field | Value |
|---|---|
| Dockerfile location | `Dockerfile.prod` |
| Entrypoint | *(leave unset)* |
| Command | *(leave unset)* |
| Target | *(leave unset)* |
| Work directory | *(leave unset)* |
| Privileged | off |

Set the exposed port to **8000** with an HTTP health check on `/health`, attach a managed
Postgres and pass its connection string as `DATABASE_URL`. The image is ~1.1 GB, mostly
the Google ADK and Prisma engine binaries, so give the build a little headroom.

### Render

The same image works unchanged. Create a **Web Service** from the repository, choose
**Docker** as the runtime, and set the Dockerfile path to `Dockerfile.prod`; leave the
Docker command and pre-deploy command empty. Create a **Postgres** instance too, then
copy its Internal Database URL into `DATABASE_URL` on the web service. Render supplies
`PORT` automatically.

## AI modes

The app runs with **zero external calls by default** (`AI_MODE=mock` in `.env.example`,
which is also the automatic fallback whenever `GEMINI_API_KEY` is unset). Approval
messages are deterministic canned text in this mode — no key needed to run or review the
app.

To use the real Gemini/ADK path:

```
# server/.env
AI_MODE=live
GEMINI_API_KEY=your-key-here
```

Restart the server. The first live call in a fresh process is slower (ADK's telemetry/
module init is a one-time cost, typically ~10-20s); subsequent calls are a few seconds.
A 20s-per-attempt timeout with one retry bounds this — see **AI error handling** below.

## API docs

With the backend running, interactive Swagger UI is at `http://localhost:4000/docs`
(raw OpenAPI JSON at `/docs.json`). Every route is documented there: request/response
shapes, the `x-employee-id` auth header, and error codes.

## Running tests

```bash
cd server
docker exec app-postgres-1 createdb -U leave_app leave_app_test   # once, if it doesn't exist
npm test
```

Or `make test` from this directory to run both suites — `make test-server` and
`make test-client` run them individually. The frontend suite (`client/`, Vitest +
React Testing Library, 68 tests) needs no database or running server: it covers the
date/staffing maths including timezone and window-clamping edges, the staffing-warning
confirm flow, manager route guarding, the approval-message rules, and the walkthrough.

44 tests: guardrail unit tests (jailbreak/injection detection, output sanitization, tool-arg
validation), error-mapping/retry/timeout unit tests, and API-level tests against a real
Postgres test database (create/list/approve/reject, auth, validation, the staffing-warning
flow). All run in `AI_MODE=mock`, no API key required.

## What's implemented vs. deferred

Everything in the assessment's core bullet list for section 2 is implemented: create/list
requests, approve/reject with a transactional status update, Postgres storage, the
AI-generated approval message with guardrails and fallback, input/error handling, and the
optional staffing-shortage warning (non-blocking).

Deferred (see `02_engineering_task.md` for the "why"): caching on the list/detail
endpoints, a settings dashboard for feature flags/AI provider config, and editable/
AI-generated message templates. None of these are needed at this app's current scale and
adding them now would be the kind of over-building the rest of the assessment argues
against.

## Simplifications (called out explicitly, not hidden)

- **Auth:** no real session/JWT system. A seeded employee id in the `x-employee-id`
  header resolves the current user (`server/src/middleware/auth.ts`) and the frontend's
  "Viewing as" picker just sets that header. A real deployment would replace this with
  actual auth; the rest of the app (authorization checks, scoping) is written against a
  `req.user` shape that a real auth layer would populate the same way.
- **Single company/tenant:** matches the documented scenario (one 4-person team), so
  there's no cross-tenant scoping logic to demonstrate.
- **No Redis/rate limiting:** the reference guardrail patterns this was built from include
  a Redis-backed usage-budget callback; that's real infrastructure this app doesn't need
  at this scale and was left out rather than added for its own sake.

## AI integration notes

- **Guardrails** (`server/src/services/ai/guardrails.ts`): input guardrail (normalize →
  jailbreak/prompt-injection pattern match → block) on the only untrusted free text that
  reaches the model (the manager's optional note); output guardrail (hard-block on
  internal-detail leaks, soft-scrub otherwise, length cap); tool-argument guardrail
  (well-formed id check) on the one ADK tool call. These are wired both provider-agnostically
  (`aiMessageService.ts`, so mock mode gets the same behavior) and directly into the ADK
  agent's `beforeModelCallback`/`afterModelCallback`/`beforeToolCallback` (`agent.ts`, so
  there's defense-in-depth on the ADK-native request/response cycle itself).
- **AI-provider error handling** (`server/src/services/ai/errors.ts`): every provider
  failure — timeout, 429, 5xx, content-safety block, malformed output — maps to a specific
  internal `error_code` and a fixed user-friendly message, never a raw provider error.
  Transient errors (429/5xx/timeout) get one retry with backoff; deterministic ones
  (400/403/content-block) don't. A wall-clock timeout (`withTimeout`) bounds each attempt
  since the ADK/Gemini SDK has no built-in request timeout of its own.
- **Fallback:** any unrecovered AI failure — provider error, guardrail block, timeout —
  results in the same default templated approval message. The approval always succeeds;
  only the message text degrades. `POST /leave-requests/:id/retry-ai-message` regenerates
  it later.
