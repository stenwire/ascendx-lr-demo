# 6. Learning and Adaptability

**Scenario:** AscendX currently uses OpenAI for the approval-message and business-question assistant, and decides to move to Gemini, a provider I haven't used in production before.

**How would I learn the new platform?**
I'd start with Gemini's official API reference and quickstart for the specific capabilities AscendX depends on: function/tool calling, structured output, and streaming. I'd build the smallest possible working call first (a single prompt/response) before touching anything AscendX-specific, so I keep "learning the API" separate from "porting the integration."

**What would I prototype first?**
I'd prototype the two riskiest existing behaviors: tool/function calling (since the business-question assistant depends on it) and structured output reliability (since some responses feed UI components). I'd reuse the exact prompts and test questions I already used for the OpenAI integration, and run them against Gemini to see where behavior diverges before doing any real migration work.

**How would I compare the new provider with the existing one?**
I'd run both side by side on the same fixed test set: the labeled question/answer set I already use to evaluate the assistant (see section 3), plus cost per call, response latency, and how reliably each provider follows the requested output format. If a provider switch regresses accuracy or reliability on my existing eval set, I wouldn't consider it ready, regardless of cost savings.

**What risks would I test before migrating production workloads?**
I'd test rate limits and quota behavior under real traffic volume, differences in safety/content filtering that might block legitimate business questions or approval messages, and structured-output/function-calling reliability under edge cases (missing data, ambiguous questions), since that's where providers tend to diverge most.

**How would I structure the integration so future provider changes are easier?**
I'd put it behind a thin provider-agnostic interface. The rest of the app calls something like `generate_approval_message(...)` or `answer_business_question(...)`, and the specific provider SDK, prompt formatting, and response parsing live entirely behind that interface. That way, swapping providers again later means changing one adapter module, not touching business logic, API routes, or the frontend.
