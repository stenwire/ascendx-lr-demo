# 2. Engineering Task

I built this one rather than only describing it. Working source is in [`/app`](../app) (setup and run instructions in `app/README.md`). What follows is the design narrative behind that implementation, plus the reasoning for a few decisions the code doesn't speak for itself on.

I went with Node.js (Express) for the API, Postgres for storage, and React for the frontend, choosing Node over Python/FastAPI per a stack preference Mr. Wale mentioned during the interview. I kept the AI-calling logic inside the same Express app as an isolated module (a single adapter interface in front of the provider client) rather than a separate FastAPI service; at this scale (one AI call per approval, a 4-person team), a second deployed service and network hop would add operational cost without a matching benefit. I used Google ADK (`@google/adk`, the JS Agent Development Kit) with Gemini as the AI provider, with an offline mock mode as the default so the app runs with zero external calls unless a `GEMINI_API_KEY` is supplied.

**Scenario:** a 4-person support team at an AscendX customer. One employee requests leave for a day two other teammates are already off, this is the case the optional staffing-shortage check is meant to catch.

**How can a user create and list leave requests?**
I built `POST /leave-requests` to take an employee id, start date, end date, and reason. It validates dates (end not before start, no requests fully in the past) before writing a row with status `pending`. `GET /leave-requests?employee_id=` lists a user's own requests, and `GET /leave-requests?status=pending` gives managers their queue. Both are plain authenticated REST endpoints; I didn't see a need for anything fancier at this scale.

**How can a manager approve or reject a request?**
`PATCH /leave-requests/{id}` with `status: approved` or `rejected`, restricted to users with a manager role over that employee. On approval, I run the staffing-shortage check first (see below), then generate the AI approval message, then update the row. Rejection just updates status; I didn't add an AI message there, since a rejection doesn't benefit from being "friendly," it benefits from being clear.

**How is application data stored?**
I used Postgres, with two main tables: `employees` (id, name, manager_id, team_id) and `leave_requests` (id, employee_id, start_date, end_date, reason, status, ai_message, created_at, decided_at). A relational store fits because the data is small and structured, and every question the app answers (who's on leave, who approved what) is a query over rows, not unstructured content needing a vector store.

**How is the AI-generated approval message produced and displayed?**
On approval, the backend calls the AI provider with a small structured prompt (employee name, dates, optional manager note) and asks for a short, friendly approval message. I store that in `leave_requests.ai_message` and show it on the request detail view for both employee and manager. Generation happens synchronously in the approve request, but I didn't block the approval itself on it: if the AI call fails, the request is still marked approved with a plain default message ("Your leave from X to Y has been approved."), and the AI message gets filled in on retry. The AI never decides the status, it only phrases a message about a decision the app has already made.

**How are invalid inputs, failed requests, and AI-provider errors handled?**

- Invalid input (bad dates, missing fields, unauthorized approver): I reject it at the API boundary with a 400/403 and a specific field-level error, never a silent failure.
- Failed requests (DB write fails mid-approval): I run the status update and staffing check in one transaction, so a failure rolls back rather than leaving a request half-approved.
- AI-provider errors (timeout, rate limit, malformed response): I catch and log them, and fall back to the default templated message rather than failing the whole approval. I map every provider failure status code (429, 5xx, timeout, content-filter rejection) internally to a specific user-friendly message, never a raw provider error surfaced to the manager. The user-facing effect of an AI outage should be "slightly less friendly text," never "you can't approve leave."
- Invalid AI inputs: I keep guardrails in the agent/tool layer itself, not as a separate filtering service, so a malformed or unexpected value never reaches the provider or gets displayed unvalidated. Concretely: an input guardrail (normalize the text, then pattern-match for prompt-injection/jailbreak attempts) on the only untrusted free text that reaches the model, the manager's optional note; an output guardrail (block or scrub anything that looks like a leaked instruction or internal implementation detail); and a tool-argument guardrail on the one tool the agent can call. I wired these directly into ADK's `beforeModelCallback` / `afterModelCallback` / `beforeToolCallback`, not bolted on afterward.

**What assumptions and trade-offs did I make?**
I assumed single-approver-per-employee (no multi-level sign-off), assumed one AI provider call per approval is cheap and fast enough to be synchronous rather than queued, and assumed the initial dataset is small enough that plain SQL queries (no caching layer) are fine. Trade-off: skipping an approval workflow engine keeps this shippable in the assessment's time box, but a second manager-in-the-loop or delegated-approver scenario would need revisiting the data model.

**Optional extension: staffing shortage warning**
I built this as a business rule, not AI: before approving, I count employees on the same `team_id` with an approved leave request overlapping the requested dates. If approving this request would drop the number of available (non-leave) team members below a configured minimum (e.g., 50% of team size), I return a warning to the manager in the approval response (not a hard block), so the manager still decides but sees the risk before confirming.

**Deferred extensions (not v1)**
These are real product ideas, but I kept them out of scope for this design. Each would expand the app well past a single-approver leave workflow, and building them now risks the same over-building I argue against above for approval chains:

- **Caching for `GET /leave-requests` (list/detail):** a TTL-based cache keyed by query params (`employee_id`, `status`), invalidated on any write to the underlying rows (new request, approval, rejection) rather than waiting out the TTL, so a manager never sees a stale queue. I deferred it because it contradicts the no-caching-layer assumption above; I'd add it once query volume or table size actually shows a bottleneck, not before.
- **Central settings dashboard:** a per-company screen for toggling LR and AI features on/off, selecting the AI provider, entering its API key, and setting AI usage limits. I deferred it because it's admin tooling sized for a platform with several AI-touching features. At one AI call site (the approval message), a provider/key/limit is a config value, not a dashboard.
- **Editable custom message templates:** letting a company edit the HTML/Jinja template behind approval/notification messages directly, with an optional "generate with AI" flow that takes a color scheme and logo and produces a branded template, would cut ongoing AI spend by making the AI a one-time template author instead of a per-approval call. I deferred it because it's a second AI-touching feature with its own UI, storage, and rendering pipeline. It's worth building once per-approval AI cost is actually shown to matter, not before.
