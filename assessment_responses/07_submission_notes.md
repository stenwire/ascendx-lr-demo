# 7. Submission Notes

**How should the reviewer run your solution?**
Section 2 (Engineering Task) is a working app, not just a written design: source is in [`/app`](../app), full setup/run instructions are in `app/README.md`. Short version: `docker compose up -d postgres`, `npm install` + `npm run prisma:migrate` + `npm run seed` + `npm run dev` in `app/server`, `npm install` + `npm run dev` in `app/client`, then open `http://localhost:5173`. It runs with zero external calls by default (mock AI mode); dropping a `GEMINI_API_KEY` into `app/server/.env` switches on the real Gemini/ADK path. `npm test` in `app/server` runs 44 tests (guardrails, error mapping, and API-level tests against a real Postgres test database).

**Which parts of my submission are complete, mocked, or intentionally simplified?**
Sections 1 and 3-6 are complete as written analysis. Section 2 has a real implementation behind it, so I'll be specific about what's genuine versus simplified there rather than leaving that vague:

- Genuine, not mocked: the create/list/approve/reject flow, Postgres storage via Prisma, the transactional approve, the staffing-shortage warning, and the AI approval-message generation (both the mock path and a real Google ADK + Gemini agent with tool-calling, guardrails, and error handling).
- Deliberately simplified and called out in `app/README.md`: no real session/JWT auth (a seeded `x-employee-id` header stands in for a logged-in user), single company/tenant, no Redis-backed rate limiting.
- Deliberately deferred, with reasoning in `assessment_responses/02_engineering_task.md`: caching on the list/detail endpoints, a settings dashboard for feature/provider config, and editable AI-generated message templates. None of these are needed at this app's scale, and I didn't want the one part of this submission with real code to be the part that demonstrates over-building.

**What were my most important technical and product decisions?**
On the product side, I chose to solve the leave workflow first, since it's the highest-frequency low-risk task and everything else (payroll accuracy, HR Q&A) depends on clean leave data. On the technical side, I kept AI out of any decision or calculation path: approvals stay deterministic and human-approved, and the AI only drafts a message about a decision that's already been made. In the actual build, that meant designing the AI integration so a slow, wrong, or malicious AI interaction degrades gracefully instead of taking down approvals: guardrails on both the input the model sees and the output it produces, a specific error code and user-facing message for every class of provider failure, a bounded timeout with one retry, and a default templated message as the floor no failure can go below.

**What would I improve if I had one additional day?**
Real auth in place of the header stand-in, and the small labeled evaluation set described in section 3 to test AI-assistant accuracy against real data rather than reasoning about it in the abstract, extended to also score the guardrails (a labeled set of injection attempts that must be blocked, and benign notes that must not be over-blocked) against the live model rather than only the pattern-matching unit tests I have now.

**What AI tools, code assistants, external libraries, or reference materials did I use?**
I used Claude Code for development. For the AI integration specifically, I pointed it at a personal curated doc as reference for the guardrail and error-handling patterns, callback-based jailbreak/prompt-injection detection, output sanitization, tool-argument validation, and a central error-code-to-message table, then had it port those patterns to TypeScript against the real `@google/adk` package. I also browsed throught the AscendX site and About page (ascendx.abjom.com) for company grounding, e.g to match branding.

Libraries: Express, Prisma, Zod, React, and Vite on the app side; general framework documentation for all of those plus Google's ADK docs (adk.dev, github.com/google/adk-js, google-adk callback docs) as reference.

Infra: Docker (containerized app and database)

**Which part of the assessment best reflects how you work, and why?**
Section 3's judgment (treat the AI assistant as a thin layer over deterministic tools and real data, never a source of answers) and section 2's implementation are the same judgment call made twice, once in the abstract and once in code. The AI never decides a leave request's status, it only phrases a message about a decision the code already made, and when the AI layer fails in any way, the code's behavior doesn't change, only the text does.
