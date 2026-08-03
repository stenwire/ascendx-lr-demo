import type { Employee, LeaveRequest } from "../../api/client";
import { addDays, formatDay, formatWeekdayInitial, isWeekend } from "../../lib/dates";
import { computeCoverage, minRequiredAvailable, windowSpan } from "../../lib/staffing";

const WINDOW_DAYS = 30;

interface Props {
  members: Employee[];
  requests: LeaveRequest[];
  windowStart: Date;
}

/**
 * A 30-day strip showing who is away and where team coverage dips below the
 * threshold the server's staffing rule uses — so a manager can see a warning
 * coming before they hit Approve.
 *
 * Layout is one CSS grid per row, sharing the same column template so the name
 * gutter and day columns line up across rows.
 */
export function AvailabilityTimeline({ members, requests, windowStart }: Props) {
  const coverage = computeCoverage(requests, members.length, windowStart, WINDOW_DAYS);
  const minRequired = minRequiredAvailable(members.length);
  const gridTemplate = { gridTemplateColumns: `9rem repeat(${WINDOW_DAYS}, minmax(0.75rem, 1fr))` };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[54rem]">
        {/* Day ruler */}
        <div className="grid items-end gap-y-1 border-b border-slate-200 pb-2" style={gridTemplate}>
          <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">Team member</span>
          {coverage.map(({ date }, i) => (
            <div key={i} className={`text-center ${isWeekend(date) ? "text-slate-300" : "text-slate-500"}`}>
              <div className="text-[10px] leading-tight">{formatWeekdayInitial(date)}</div>
              <div className="tabular text-[10px] leading-tight">{date.getUTCDate()}</div>
            </div>
          ))}
        </div>

        {/* One row per member */}
        {members.map((member) => {
          const theirs = requests.filter((r) => r.employeeId === member.id && r.status !== "rejected");
          return (
            <div key={member.id} className="grid items-center border-b border-slate-100 py-2" style={gridTemplate}>
              <span className="truncate pr-3 text-sm text-slate-700">{member.name}</span>

              {/* Background cells, so weekends read even where there's no leave */}
              {coverage.map(({ date, understaffed }, i) => (
                <div
                  key={i}
                  className={`h-6 ${understaffed ? "bg-pending-bg/60" : isWeekend(date) ? "bg-slate-50" : ""}`}
                  style={{ gridColumn: i + 2, gridRow: 1 }}
                />
              ))}

              {/* Leave bars layered over those cells */}
              {theirs.map((request) => {
                const span = windowSpan(request, windowStart, WINDOW_DAYS);
                if (!span) return null;
                const approved = request.status === "approved";
                return (
                  <div
                    key={request.id}
                    title={`${request.reason} · ${formatDay(request.startDate)} to ${formatDay(request.endDate)}${
                      approved ? "" : " (pending)"
                    }`}
                    style={{ gridColumn: `${span.startOffset + 2} / span ${span.span}`, gridRow: 1 }}
                    className={`z-10 h-6 rounded ${
                      approved
                        ? "bg-brand-500"
                        : "border border-dashed border-brand-500 bg-brand-100"
                    }`}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Coverage row */}
        <div className="grid items-center pt-2" style={gridTemplate}>
          <span className="pr-3 text-xs font-medium tracking-wide text-slate-500 uppercase">Available</span>
          {coverage.map(({ date, available, understaffed }, i) => (
            <div
              key={i}
              title={`${formatDay(date)}: ${available} of ${members.length} available${
                understaffed ? ` (below minimum of ${minRequired})` : ""
              }`}
              className={`tabular mx-px rounded py-1 text-center text-[10px] font-medium ${
                understaffed ? "bg-pending-bg text-pending-text" : "text-slate-400"
              }`}
            >
              {available}
            </div>
          ))}
        </div>
      </div>

      <Legend minRequired={minRequired} teamSize={members.length} />
    </div>
  );
}

function Legend({ minRequired, teamSize }: { minRequired: number; teamSize: number }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-brand-500" aria-hidden="true" />
        Approved leave
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-dashed border-brand-500 bg-brand-100" aria-hidden="true" />
        Pending
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-pending-bg" aria-hidden="true" />
        Below {minRequired} of {teamSize} available
      </span>
    </div>
  );
}

export { WINDOW_DAYS };
export const timelineWindowEnd = (start: Date) => addDays(start, WINDOW_DAYS - 1);
