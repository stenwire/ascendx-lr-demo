# 5. Startup Judgment and Prioritisation

**Scenario:** I am a solo engineer at AscendX, three things land on my table at once: a payroll bug, a possible cross-tenant data leak, and a CEO demo request due tomorrow.

**In what order would I handle these issues, and why?**
I'd handle the security issue first, the payroll bug second, and the demo feature last. A possible cross-tenant leak is a trust and legal exposure that grows the longer it's live: every minute it's unaddressed is more potential exposure across every customer, not just one. The payroll bug is serious but bounded; it affects specific pay calculations and I can contain it (hold the affected payroll run) while I investigate. The demo feature is the most deferrable: a demo can be adjusted or delayed, but customer data exposure and incorrect pay can't.

**What immediate actions would I take for each issue?**

- Security: I'd confirm whether it's actually exploitable, and if so, patch or disable the vulnerable path immediately even if the fix is temporary (e.g., add a scoping check), before doing root-cause analysis.
- Payroll: I'd identify which company/employees are affected, hold or flag those specific payroll runs if not yet disbursed, and leave payroll running for unaffected customers.
- Demo: I'd message the CEO early that security and payroll are taking priority, and propose a reduced-scope demo (mock data, a narrower feature slice) rather than silently missing the deadline.

**What would I delay or reduce in scope?**
I'd reduce the demo feature's scope first: a smaller working demo beats a full one built under time pressure while ignoring an active security issue. If needed, I'd also let non-critical parts of the payroll investigation (the full root-cause writeup) wait until the immediate leak and disbursement risk are contained.

**Who would I communicate with, and what would you tell them?**
I'd tell the CEO immediately that a possible security issue takes precedence, with a realistic revised demo scope or timeline, not silence until the next day. I'd inform any affected customers once impact is confirmed, with what's affected and an ETA, not before it's understood, since an unconfirmed alarm creates its own problems.

**How would I balance speed, customer impact, security, and product goals?**
For me, security and correctness of money and data come before speed on a demo, because those failures are the kind that lose customer trust permanently. A delayed demo is recoverable; a data leak or wrong paycheck is a much harder thing to walk back.
