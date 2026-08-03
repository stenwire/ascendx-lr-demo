import { Link, useNavigate } from "react-router-dom";
import { listMyLeaveRequests, listPendingQueue, type LeaveRequest } from "../api/client";
import { useIdentity } from "../auth/IdentityContext";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DataTable, type Column } from "../components/ui/DataTable";
import { PageHeader } from "../components/ui/PageHeader";
import { StatTile } from "../components/ui/StatTile";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EmptyState, ErrorState, TableSkeleton } from "../components/ui/States";
import { PlusIcon } from "../components/layout/icons";
import { useAsync } from "../hooks/useAsync";
import { formatDateRange, inclusiveDayCount, parseDateKey, todayUtc } from "../lib/dates";

export function OverviewPage() {
  const { me, isManager, directReports } = useIdentity();
  const navigate = useNavigate();
  const meId = me!.id;
  const reportIds = directReports.map((r) => r.id).join(",");

  const mine = useAsync(() => listMyLeaveRequests(meId), [meId]);

  // Only a manager needs the queue; employees skip the call entirely.
  const queue = useAsync(async () => {
    if (!isManager) return [] as LeaveRequest[];
    const leaveRequests = await listPendingQueue(meId);
    const reports = new Set(reportIds ? reportIds.split(",") : []);
    return leaveRequests.filter((r) => reports.has(r.employeeId));
  }, [meId, isManager, reportIds]);

  const myRequests = mine.data ?? [];
  const today = todayUtc();

  const upcoming = myRequests.filter((r) => r.status === "approved" && parseDateKey(r.endDate) >= today);
  const daysApproved = myRequests
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + inclusiveDayCount(r.startDate, r.endDate), 0);
  const myPending = myRequests.filter((r) => r.status === "pending").length;

  const columns: Column<LeaveRequest>[] = [
    {
      key: "dates",
      header: "Dates",
      render: (r) => <span className="font-medium text-slate-900">{formatDateRange(r.startDate, r.endDate)}</span>,
    },
    { key: "reason", header: "Reason", render: (r) => <span className="text-slate-600">{r.reason}</span> },
    { key: "status", header: "Status", className: "w-32", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${me!.name.split(" ")[0]}`}
        description="Your leave at a glance."
        action={
          <Button variant="primary" onClick={() => navigate("/requests/new")}>
            <PlusIcon />
            New request
          </Button>
        }
      />

      {/* Below sm these scroll sideways as a compact row: four stacked tiles push
          the actual content off a phone screen. They stay within the page's own
          gutters rather than bleeding to the edge, so they line up with the cards
          below. From sm up they lay out as a grid, where there is room. */}
      <div
        className="mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
          sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0
          lg:grid-cols-4"
      >
        <StatTile label="Awaiting decision" value={myPending} hint="Your requests not yet decided" />
        <StatTile label="Days approved" value={daysApproved} hint="Across all approved leave" />
        <StatTile label="Upcoming leave" value={upcoming.length} hint="Approved and still ahead" />
        {isManager && (
          <StatTile
            label="To review"
            value={queue.data?.length ?? 0}
            hint="Requests from your reports"
            emphasis={(queue.data?.length ?? 0) > 0}
          />
        )}
      </div>

      {isManager && (queue.data?.length ?? 0) > 0 && (
        <Card className="mb-6">
          <CardHeader
            title="Waiting on you"
            description={`${queue.data!.length} request${queue.data!.length === 1 ? "" : "s"} from your team`}
            action={
              <Link to="/approvals" className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
                Go to approvals
              </Link>
            }
          />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Your recent requests"
          action={
            <Link to="/requests" className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          }
        />
        {mine.loading ? (
          <TableSkeleton rows={3} />
        ) : mine.error ? (
          <ErrorState message={mine.error} onRetry={mine.refetch} />
        ) : myRequests.length === 0 ? (
          <EmptyState
            message="You haven't requested any leave yet."
            action={
              <Button variant="primary" onClick={() => navigate("/requests/new")}>
                New request
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={myRequests.slice(0, 5)}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/requests/${r.id}`)}
          />
        )}
      </Card>
    </>
  );
}
