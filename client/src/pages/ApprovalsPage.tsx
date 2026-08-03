import { useState } from "react";
import { toUserMessage } from "../lib/errorMessages";
import { Link } from "react-router-dom";
import { decideLeaveRequest, listPendingQueue, type LeaveRequest, type StaffingWarning } from "../api/client";
import { useIdentity } from "../auth/IdentityContext";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert, EmptyState, ErrorState, TableSkeleton } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { formatDateRange, formatTimestamp, inclusiveDayCount } from "../lib/dates";

export function ApprovalsPage() {
  const { me, directReports } = useIdentity();
  const meId = me!.id;
  const reportIds = directReports.map((r) => r.id).join(",");

  const { data, loading, error, refetch } = useAsync(async () => {
    const leaveRequests = await listPendingQueue(meId);
    // status=pending returns every pending request org-wide, so scope it to this
    // manager's own reports.
    const reports = new Set(reportIds ? reportIds.split(",") : []);
    return leaveRequests.filter((r) => reports.has(r.employeeId));
  }, [meId, reportIds]);

  const [warnings, setWarnings] = useState<Record<string, StaffingWarning>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const nameOf = (id: string) => directReports.find((e) => e.id === id)?.name ?? id;

  async function decide(requestId: string, status: "approved" | "rejected", acknowledge = false) {
    setActionError(null);
    setBusyId(requestId);
    try {
      const result = await decideLeaveRequest(meId, requestId, status, acknowledge);

      // A staffing shortage comes back as 200 with decided:false — nothing was
      // applied, the manager has to confirm.
      if (!result.decided && result.staffingWarning) {
        setWarnings((prev) => ({ ...prev, [requestId]: result.staffingWarning! }));
        return;
      }

      setWarnings((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      refetch();
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const requests = data ?? [];

  return (
    <>
      <PageHeader
        title="Approvals"
        description={
          requests.length > 0
            ? `${requests.length} request${requests.length === 1 ? "" : "s"} waiting on you.`
            : "Requests from your direct reports."
        }
      />

      {actionError && (
        <div className="mb-4">
          <Alert tone="error">{actionError}</Alert>
        </div>
      )}

      {loading ? (
        <Card>
          <TableSkeleton />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={refetch} />
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState message="No pending requests." />
        </Card>
      ) : (
        <div className="space-y-3" data-tour="approvals-queue">
          {requests.map((request) => (
            <ApprovalRow
              key={request.id}
              request={request}
              employeeName={nameOf(request.employeeId)}
              warning={warnings[request.id]}
              busy={busyId === request.id}
              onDecide={decide}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ApprovalRow({
  request,
  employeeName,
  warning,
  busy,
  onDecide,
}: {
  request: LeaveRequest;
  employeeName: string;
  warning?: StaffingWarning;
  busy: boolean;
  onDecide: (id: string, status: "approved" | "rejected", acknowledge?: boolean) => void;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold text-slate-900">{employeeName}</h2>
              <span className="tabular text-sm text-slate-700">
                {formatDateRange(request.startDate, request.endDate)}
              </span>
              <span className="text-xs text-slate-500">
                {inclusiveDayCount(request.startDate, request.endDate)} days
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-600">{request.reason}</p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              Submitted {formatTimestamp(request.createdAt)}
            </p>
          </div>

          <div className="flex w-full shrink-0 gap-2 sm:w-auto">
            <Button
              variant="primary"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => onDecide(request.id, "approved", Boolean(warning))}
            >
              {busy ? "Working…" : warning ? "Approve anyway" : "Approve"}
            </Button>
            <Button
              variant="danger"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => onDecide(request.id, "rejected")}
            >
              Reject
            </Button>
          </div>
        </div>

        {warning && (
          <div className="mt-4">
            <Alert tone="warning" title="Approving this leaves the team short">
              Only {warning.availableAfterApproval} of {warning.teamSize} on team “{warning.teamId}” would be
              available, below the minimum of {warning.minRequired}. Nothing has been approved yet — choose
              “Approve anyway” to continue.
            </Alert>
          </div>
        )}

        <div className="mt-3">
          <Link to={`/requests/${request.id}`} className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
            View details
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
