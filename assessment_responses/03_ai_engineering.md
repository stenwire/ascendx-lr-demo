# 3. AI Engineering

**Scenario:** an AscendX customer's office manager asks the assistant "how much payroll is due next Friday?" across a company with 40 employees on mixed pay schedules.

**Why might the assistant hallucinate when answering these questions?**
Because a question like this has a knowable, current answer sitting in a database, and if the assistant is just a language model answering from a prompt, it has no access to that data, so it'll generate a plausible-sounding number instead of the real one. Ambiguity makes it worse: "next Friday" and "currently on leave" depend on the current date and live records, not general knowledge, so the model fills the gap with a guess.

**How would I design the system so answers are grounded in current business data?**
I wouldn't let the assistant answer these questions from its own knowledge at all. I'd have it call a tool (e.g., `get_payroll_due(date_range)`, `get_employees_on_leave(date)`) that runs a real, deterministic query against the company's data. The model's job is limited to interpreting the question into the right tool call and phrasing the result, not computing or recalling the number itself.

**When would I use tool or function calling, retrieval, structured outputs, or deterministic business logic?**

- Tool/function calling: for anything that maps to a specific, known query, like "who's on leave," "who hasn't submitted a timesheet," or "payroll due by date."
- Retrieval: for open-ended questions over unstructured content, like a company's HR policy documents, where there's no fixed schema to query.
- Structured outputs: whenever the response feeds into a UI component or another system (e.g., a table of employees), I want a typed object back, not free text I have to re-parse.
- Deterministic business logic: for anything involving money or compliance. Payroll totals get calculated by code; the model only narrates a result the code already produced, it never does the arithmetic itself.

**How would I prevent one company from accessing another company's data?**
I'd scope every tool call server-side to the authenticated user's `company_id`, injected by the backend, never accepted as a parameter the model or user can set. The model's tool-calling layer only ever sees pre-scoped functions; "get employees on leave" always means "for this company," and there's no code path where a tenant id is optional or client-supplied. I'd enforce isolation at the data access layer (row-level filtering or per-tenant schema), not by asking the model to behave.

**How would I evaluate the accuracy and reliability of the assistant before release?**
I'd build a small labeled test set of realistic questions with known-correct answers pulled from real seeded data (e.g., "how many people are on leave today" with a fixed answer), run it against the assistant, and grade exact-match or human-reviewed correctness before every release. I'd include adversarial cases too (ambiguous dates, no data available, cross-tenant attempts) to confirm the assistant declines or asks for clarification instead of guessing. If I wanted to standardize this properly, I'd look at setting up an actual eval pipeline with something like LangSmith, which lets you build custom datasets, define evaluation criteria, and view and analyze agent traces (tool calls, agent chaining, etc.). The downside is that a feature-rich managed tool like that usually comes at a cost.

**How would I monitor quality, cost, latency, and failures in production?**
I'd log every assistant interaction (the tool calls made, tokens used, response time), then track sampled human or automated review of answer quality over time, cost per query and per company (token usage x provider pricing), p50/p95 latency, and a failure rate metric for tool-call errors, timeouts, or fallback-to-generic-answer events. I'd alert on latency spikes or a rising fallback rate so I catch provider-side issues before customers report them. I'd also consider a tool like LangSmith or one of its open-source equivalents, like Langfuse or Lunary.
