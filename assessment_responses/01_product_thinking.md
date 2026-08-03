# 1. Product Thinking

**Scenario:** an AscendX Business OS customer runs a 15-person marketing agency. The owner personally tracks leave on a shared spreadsheet, re-enters payroll numbers by hand each cycle, and answers the same "how many PTO days do I have left" question over Slack every week.

**What problem is the business owner actually trying to solve?**
I don't think this is a lack of features, it's a lack of time. The owner is stuck doing manual coordination work: chasing status, re-entering the same data in two places, and answering questions that already have a knowable answer. The way I read it, the real ask is "get this off my plate without giving me a new tool I have to babysit."

**What feature would I build first, and why?**
I'd build a single leave request and approval workflow first: employee submits, manager approves or rejects, status is visible to both sides without a follow-up message. It's the highest-frequency, lowest-risk touchpoint, and it's also the input every payroll and staffing question downstream depends on. If I fix leave first, the payroll and HR-question problems get easier to solve later. If I build payroll or Q&A first, I'm building on top of messy leave data.

**What would I intentionally not build in the first version?**
I'd hold off on full payroll processing, benefits administration, and performance reviews. I also wouldn't build configurable approval chains (multi-level sign-off) at launch. A single manager approver covers most SMB teams, and configurable workflows are easy to over-build before anyone's actually asked for one.

**How could AI improve the solution without creating unnecessary risk?**
I'd keep it to two narrow uses: drafting the friendly approval/rejection message so the manager doesn't have to write one by hand, and answering repetitive HR questions ("how many leave days do I have left") by querying real leave records rather than generating an answer from general knowledge. My risk boundary is that AI never makes the approval decision or touches payroll numbers directly: a human approves, and AI only summarizes or drafts text around a decision or number that already exists in the database.

**How would I measure whether the feature is successful after launch?**
I'd track manager time per request (time between submission and decision), the number of leave-related Slack/email messages still happening outside the tool (a proxy for whether people trust it enough to stop asking manually), and the rate of payroll corrections tied to leave errors after rollout.
