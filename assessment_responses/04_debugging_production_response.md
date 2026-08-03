# 4. Debugging and Production Response

**Scenario:** an AscendX customer reports that an employee's pay for a period with approved leave came out wrong, off by roughly a day's worth of pay.

**What would I do first?**
First, I'd confirm scope before touching anything: is this one employee, one company, or systemic. I'd pull the affected employee's leave records and the payroll run that produced the number, and check whether the payroll run has already been paid out or is still pending, since that determines urgency.

**How would I  reproduce and isolate the problem?**
I'd take the specific leave request and payroll period involved, replay the payroll calculation against a staging copy of that data, and compare the output to what production generated. I'd narrow the variable: try a leave request fully inside one pay period first, then a leave request that spans two pay periods or overlaps a weekend/holiday, since date-boundary and proration logic is the most common source of this class of bug.

**What logs, data, metrics, or system events would I inspect?**
I'd look at the leave-approval event log (exact approved start/end dates and timestamp), the payroll calculation's input snapshot for that employee (what leave data it read at run time), and whether the leave was approved before or after the payroll run started. A race between "leave approved" and "payroll calculated" is a likely culprit.

**What tests would I add?**
I'd add regression tests for partial-period leave (leave starting or ending mid pay-period), leave spanning a pay-period boundary, and leave approved after a payroll run has already started calculating. I'd also add a test asserting payroll calculation only reads leave requests with status `approved` as of the calculation's snapshot time, not requests approved afterward.

**How would I reduce customer impact while investigating?**
If payroll hasn't been disbursed yet, I'd hold that specific run or flag the affected employees for manual review rather than blocking the whole company's payroll. If it's already been paid, I'd calculate the correction amount and communicate a fix timeline immediately rather than waiting for the root cause to be fully resolved.

**How would I communicate progress to technical and non-technical stakeholders?**
To engineering, I'd give a root-cause hypothesis with the specific data (which employee, which dates, which code path), updated as it firms up. To the customer or non-technical stakeholder, I'd stick to what's affected, what isn't, and a concrete timeline, e.g. "this affects leave that spans a pay-period boundary, we've identified the cause, corrected pay will be issued by [date]," without unnecessary technical detail.
