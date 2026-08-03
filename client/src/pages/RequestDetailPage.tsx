import { useState } from "react";
import { toUserMessage } from "../lib/errorMessages";
import { useNavigate, useParams } from "react-router-dom";
import { getLeaveRequest, retryAiMessage } from "../api/client";
import { useIdentity } from "../auth/IdentityContext";
import { ArrowLeftIcon, RefreshIcon } from "../components/layout/icons";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Alert, ErrorState, Skeleton } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { formatDateRange, formatTimestamp, inclusiveDayCount } from "../lib/dates";

export function RequestDetailPage() {
  const { id = "" } = useParams();
  const { me, employees } = useIdentity();
  const navigate = useNavigate();
  const meId = me!.id;

  const { data, loading, error, refetch } = useAsync(() => getLeaveRequest(meId, id), [meId, id]);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const request = data;
  const nameOf = (employeeId: string | null) =>
    employeeId ? (employees.find((e) => e.id === employeeId)?.name ?? "Unknown") : null;

  async function onRegenerate() {
    setRegenerateError(null);
    setRegenerating(true);
    try {
      await retryAiMessage(meId, id);
      refetch();
    } catch (err) {
      setRegenerateError(toUserMessage(err));
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !request) {
    return <ErrorState message={error ?? "Request not found."} onRetry={refetch} />;
  }

  const isMine = request.employeeId === meId;
  // Only the employee's manager can regenerate, and only once approved — the
  // endpoint rejects anything else.
  const canRegenerate = request.status === "approved" && !isMine;

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        Back
      </button>

      <PageHeader
        title={formatDateRange(request.startDate, request.endDate)}
        description={isMine ? "Your leave request" : `Request from ${nameOf(request.employeeId)}`}
        action={<StatusBadge status={request.status} />}
      />

      <div className="max-w-3xl space-y-4">
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Employee</dt>
                <dd className="mt-1 text-sm text-slate-900">{nameOf(request.employeeId)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Length</dt>
                <dd className="tabular mt-1 text-sm text-slate-900">
                  {inclusiveDayCount(request.startDate, request.endDate)} days
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Reason</dt>
                <dd className="mt-1 text-sm text-slate-900">{request.reason}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* Rejections carry no generated message by design, so this section is
            omitted rather than rendered empty. */}
        {request.status === "approved" && (
          <Card>
            <CardHeader
              title="Approval message"
              description="Sent to the employee when the request was approved."
              action={
                canRegenerate ? (
                  <Button size="sm" onClick={onRegenerate} disabled={regenerating}>
                    <RefreshIcon className="h-3.5 w-3.5" />
                    {regenerating ? "Regenerating…" : "Regenerate"}
                  </Button>
                ) : undefined
              }
            />
            <CardBody className="space-y-3">
              {request.aiMessage ? (
                <blockquote className="border-l-2 border-brand-500 bg-brand-50 py-3 pr-4 pl-4 text-sm text-slate-700">
                  {request.aiMessage}
                </blockquote>
              ) : (
                <p className="text-sm text-slate-500">No message was generated for this request.</p>
              )}
              {regenerateError && <Alert tone="error">{regenerateError}</Alert>}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="History" />
          <CardBody>
            <ol className="space-y-4">
              <TimelineRow label="Submitted" by={nameOf(request.employeeId)} at={request.createdAt} />
              {request.decidedAt && (
                <TimelineRow
                  label={request.status === "approved" ? "Approved" : "Rejected"}
                  by={nameOf(request.decidedById)}
                  at={request.decidedAt}
                  last
                />
              )}
              {!request.decidedAt && (
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pending-border" aria-hidden="true" />
                  <p className="text-sm text-slate-500">Waiting for a decision from the manager.</p>
                </li>
              )}
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function TimelineRow({
  label,
  by,
  at,
  last = false,
}: {
  label: string;
  by: string | null;
  at: string;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${last ? "bg-brand-500" : "bg-slate-300"}`}
        aria-hidden="true"
      />
      <div>
        <p className="text-sm text-slate-900">
          {label}
          {by && <span className="text-slate-500"> by {by}</span>}
        </p>
        <p className="font-mono text-xs text-slate-500">{formatTimestamp(at)}</p>
      </div>
    </li>
  );
}
