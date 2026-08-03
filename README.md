# AscendX Leave Requests
> https://ascendx-lr-demo.onrender.com/

Employees submit leave requests, managers approve or reject them, and an AI assistant
drafts the approval message. This is the section 2 engineering task from the take-home
assessment.

Design rationale and trade-offs live in
[`assessment_responses/02_engineering_task.md`](assessment_responses/02_engineering_task.md).
The running app explains itself on its **How it works** page. This README covers how to
run and deploy it.

**Stack:** Node.js, TypeScript, Express, Prisma, Postgres, React, Vite, Tailwind v4,
Google ADK with Gemini (offline mock mode by default).

## Running it

Requires Docker. Postgres, the API and the frontend are all containerised, with source
bind-mounted so edits hot-reload.

```bash
make up            # build and start everything
make docker-seed   # once, to load the sample team and leave requests
```

Open `http://localhost:5173`. Sign in as **Dana Wale** to see the manager views, or any
other employee to submit leave.

`make help` lists every target. To run the server and client on the host instead (for a
debugger, say), use `make up-db` for Postgres only, then `make install`, `make migrate`,
`make seed`, `make dev-server` and `make dev-client`.

### Tests

```bash
make test          # both suites; make test-server / make test-client run them separately
```

153 tests. The server suite (64) runs against a real Postgres test database and covers the
guardrails, AI error mapping and retry, the HTTP API, read authorisation, and the demo
reset. The client suite (89, Vitest and React Testing Library) needs no database and
covers the date and staffing maths, the staffing-warning flow, route guarding, error
mapping and the walkthrough. Everything runs in `AI_MODE=mock`, so no API key is needed.

## Frontend

A dashboard shell with a dark sidebar, one route per action:

| Route | Screen | Access |
|---|---|---|
| `/` | Overview: stat tiles and recent requests | all |
| `/requests` | Own requests, filterable by status | all |
| `/requests/new` | New request form | all |
| `/requests/:id` | Detail: history, approval message, regenerate | all |
| `/approvals` | Pending queue with the staffing warning inline | manager |
| `/team` | 30 day availability timeline | manager |
| `/account` | Profile and the employee id used for API calls | all |
| `/help` | How the app works, plus demo data reset | all |

Manager routes are hidden from non-managers and redirect to `/`. Switching employee while
viewing one record returns to `/requests`, because the id in the URL belonged to the
previous person.

Tables become stacked cards below `sm` and the sidebar becomes a drawer below `lg`. A
guided walkthrough runs on first visit and can be replayed from **How it works**.

Design tokens live in `client/src/index.css` under Tailwind's `@theme` block. The brand
colour `#00BCFF` only reaches about 2.2:1 against white, so it carries accents, active
states and the dark sidebar, while `brand-700` (`#007EAD`) carries text and buttons on
light surfaces to clear WCAG AA.

## AI modes

The app makes **zero external calls by default**. `AI_MODE=mock` produces deterministic
canned approval messages, and it is also the automatic fallback whenever `GEMINI_API_KEY`
is unset, so the app runs and reviews without credentials.

For the real Gemini path, set `AI_MODE=live` and `GEMINI_API_KEY` in `server/.env`, then
restart. The first live call in a fresh process takes 10 to 20 seconds while ADK
initialises; later calls take a few. Each attempt is bounded by a 20 second timeout with
one retry.

Guardrails, provider error mapping and the fallback behaviour are described on the
**How it works** page and in `assessment_responses/02_engineering_task.md`. In short: any
unrecovered AI failure degrades to a templated message, the approval itself always
succeeds, and the message can be regenerated later.

## API

Every endpoint answers in one envelope, built by `successResponse` and `failureResponse`
in `server/src/utils/apiResponse.ts`. `data` carries the resource itself, an object for a
single record or an array for a collection.

```jsonc
{ "status": "success", "message": "Leave request submitted.", "data": { "id": "…" } }

{ "status": "error", "message": "endDate cannot be before startDate.", "data": null,
  "code": "invalid_input", "field": "endDate" }
```

Codes: `invalid_input`, `unauthenticated`, `forbidden`, `not_found`, `internal_error`,
`demo_team_missing`. `GET /docs.json` is the one unwrapped response, since tooling expects
the raw OpenAPI document.

The frontend never shows a raw code or status line. `client/src/lib/errorMessages.ts` maps
each code to user-facing copy, falling back to the HTTP status. Validation failures pass
through unchanged, because the server message already names the offending field.

Interactive Swagger UI is at `http://localhost:4000/docs`.

### Read authorisation

Enforced in the service layer, not the UI. An employee sees their own records; a manager
also sees their direct reports'.

- `GET /leave-requests/:id` returns **404** when the caller may not see it, matching the
  response for an id that does not exist. A 403 would confirm someone else's request lives
  at that id.
- `GET /leave-requests?employee_id=…` returns **403** for anyone who is neither the
  employee nor their manager.
- `GET /leave-requests?status=pending` returns only the caller's own reports.
- `POST /leave-requests/:id/retry-ai-message` is restricted to the employee's manager.
  `PATCH /leave-requests/:id` already was.

Responses also carry `Cache-Control: no-store` and `Vary: x-employee-id`, since they are
personalised by that header while the URL stays the same.

> Adding an API prefix? List it in `API_PREFIXES` in `server/src/app.ts`, in the
> `no-store` middleware beside it, and in the proxy list in `client/vite.config.ts`.
> Missing the last one 404s in development only.

## Deploying

`Dockerfile.prod` builds a single container running the whole app: the frontend is
compiled to static files and served by the API from the same origin, so there is one
service and one port. Migrations run before the server accepts traffic.

```bash
docker build -f Dockerfile.prod -t ascendx-lr .
docker run -p 8000:8000 -e DATABASE_URL="postgresql://…" ascendx-lr
```

On **Render**: create a Web Service from the repository, choose Docker as the runtime, and
set the Dockerfile path to `Dockerfile.prod`. Leave the Docker command, pre-deploy command
and every other override empty, since the image sets its own workdir, entrypoint and
command. Render supplies `PORT`.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Managed Postgres 16, never `localhost` |
| `PORT` | no | Defaults to `8000`, usually injected by the platform |
| `AI_MODE` | no | `mock` (default) or `live` |
| `GEMINI_API_KEY` | for `live` | Falls back to `mock` when unset |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest` |
| `STAFFING_MIN_AVAILABLE_RATIO` | no | Defaults to `0.5` |
| `SEED_FORCE` | no | `true` resets demo data on next start |

### The database is not part of the image

`docker-compose.yml` runs Postgres for local development only. A hosted deployment needs
its own instance. Copying `DATABASE_URL` out of `server/.env` will not work, because
inside a container `localhost` is the container itself, and Prisma fails at boot with
`P1001: Can't reach database server`.

Most managed providers require TLS, so append `?sslmode=require` unless the provider's own
string includes it. On Render, the Internal Database URL needs no `sslmode` when the
database and service share a region.

**Using Supabase?** The direct host `db.<project-ref>.supabase.co` resolves to IPv6 only,
and Render has no IPv6 egress, so it fails with `P1001` despite correct credentials. Use
the **session pooler** instead, which has IPv4. Its string differs in two places, the host
and the username:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Copy the exact value from Project Settings, Database, Connection string, Session pooler.
Stay on port 5432. The transaction pooler on 6543 does not support the advisory locks
`prisma migrate deploy` needs.

### Seeding a deployed instance

The image runs the seed on every container start, but it is a no-op once employees exist,
so restarts never destroy data. An instance seeded before the sample leave requests were
added keeps its empty history: run once with `SEED_FORCE=true`, then remove the variable.

A manager can also restore the sample requests from **How it works**, no redeploy needed.
That replaces leave requests only, leaving employees alone so stored identities stay valid.

## Simplifications

Called out rather than hidden.

- **No real login.** A seeded employee id in the `x-employee-id` header identifies the
  caller, and the account menu just changes which id is sent. Authorisation and scoping are
  written against a `req.user` shape that a real auth layer would populate identically.
- **Single tenant.** Matches the scenario in the assessment, so there is no cross-tenant
  scoping to demonstrate.
- **No Redis or rate limiting.** The reference guardrail patterns include a Redis-backed
  usage budget. That is real infrastructure this app does not need at this scale.
- **The team view fans out** one request per direct report, because there is no
  team-scoped list endpoint. Fine at this size, worth fixing if a team grew.
