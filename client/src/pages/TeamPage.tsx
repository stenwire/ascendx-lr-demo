import { listTeamLeaveRequests } from "../api/client";
import { useIdentity } from "../auth/IdentityContext";
import { AvailabilityTimeline, WINDOW_DAYS, timelineWindowEnd } from "../components/team/AvailabilityTimeline";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/DataTable";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ErrorState, Skeleton } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { formatDay, inclusiveDayCount, parseDateKey, todayUtc } from "../lib/dates";
import type { Employee, LeaveRequest } from "../api/client";

export function TeamPage() {
  const { me, directReports } = useIdentity();
  const meId = me!.id;
  const reportIds = directReports.map((r) => r.id).join(",");

  const { data, loading, error, refetch } = useAsync(
    () => listTeamLeaveRequests(meId, reportIds ? reportIds.split(",") : []),
    [meId, reportIds],
  );

  const windowStart = todayUtc();
  const requests = data ?? [];

  return (
    <>
      <PageHeader
        title="Team"
        description={`${directReports.length} direct report${directReports.length === 1 ? "" : "s"}.`}
      />

      <div className="space-y-4">
        <Card className="scroll-mt-20" data-tour="team-timeline">
          <CardHeader
            title="Availability"
            description={`${formatDay(windowStart)} – ${formatDay(timelineWindowEnd(windowStart))} · next ${WINDOW_DAYS} days`}
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : error ? (
              <ErrorState message={error} onRetry={refetch} />
            ) : (
              <AvailabilityTimeline members={directReports} requests={requests} windowStart={windowStart} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Who's away" description="Approved and pending leave still ahead." />
          {loading ? (
            <CardBody>
              <Skeleton className="h-24 w-full" />
            </CardBody>
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <UpcomingTable requests={requests} members={directReports} />
          )}
        </Card>
      </div>
    </>
  );
}

function UpcomingTable({ requests, members }: { requests: LeaveRequest[]; members: Employee[] }) {
  const today = todayUtc();
  const upcoming = requests
    .filter((r) => r.status !== "rejected" && parseDateKey(r.endDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (upcoming.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">No upcoming leave.</p>;
  }

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  const columns: Column<LeaveRequest>[] = [
    {
      key: "who",
      header: "Employee",
      render: (r) => <span className="font-medium text-slate-900">{nameOf(r.employeeId)}</span>,
    },
    {
      key: "dates",
      header: "Dates",
      render: (r) => (
        <span className="tabular text-slate-700">
          {formatDay(r.startDate)} – {formatDay(r.endDate)}
        </span>
      ),
    },
    {
      key: "days",
      header: "Days",
      className: "w-20",
      render: (r) => <span className="text-slate-600">{inclusiveDayCount(r.startDate, r.endDate)}</span>,
    },
    { key: "status", header: "Status", className: "w-32", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return <DataTable columns={columns} rows={upcoming} rowKey={(r) => r.id} />;
}
