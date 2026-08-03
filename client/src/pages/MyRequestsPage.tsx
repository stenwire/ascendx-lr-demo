import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyLeaveRequests, type LeaveRequest, type LeaveStatus } from "../api/client";
import { useIdentity } from "../auth/IdentityContext";
import { PlusIcon } from "../components/layout/icons";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/DataTable";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EmptyState, ErrorState, TableSkeleton } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { formatDateRange, formatTimestamp, inclusiveDayCount } from "../lib/dates";

const FILTERS: { value: LeaveStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function MyRequestsPage() {
  const { me } = useIdentity();
  const navigate = useNavigate();
  const meId = me!.id;
  const [filter, setFilter] = useState<LeaveStatus | "all">("all");

  const { data, loading, error, refetch } = useAsync(() => listMyLeaveRequests(meId), [meId]);
  const all = data?.leaveRequests ?? [];
  const rows = filter === "all" ? all : all.filter((r) => r.status === filter);

  const columns: Column<LeaveRequest>[] = [
    {
      key: "dates",
      header: "Dates",
      render: (r) => <span className="font-medium text-slate-900">{formatDateRange(r.startDate, r.endDate)}</span>,
    },
    {
      key: "days",
      header: "Days",
      className: "w-20",
      render: (r) => <span className="text-slate-600">{inclusiveDayCount(r.startDate, r.endDate)}</span>,
    },
    { key: "reason", header: "Reason", render: (r) => <span className="text-slate-600">{r.reason}</span> },
    {
      key: "submitted",
      header: "Submitted",
      className: "hidden md:table-cell w-44",
      render: (r) => <span className="text-xs text-slate-500">{formatTimestamp(r.createdAt)}</span>,
    },
    { key: "status", header: "Status", className: "w-32", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="My requests"
        description="Every leave request you've submitted."
        action={
          <Button variant="primary" onClick={() => navigate("/requests/new")}>
            <PlusIcon />
            New request
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label="Filter by status">
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          const count = value === "all" ? all.length : all.filter((r) => r.status === value).length;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={active}
              className={`rounded-control border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-brand-700 bg-brand-50 font-medium text-brand-700"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
              <span className="tabular ml-1.5 text-xs text-slate-500">{count}</span>
            </button>
          );
        })}
      </div>

      <Card>
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            message={
              all.length === 0
                ? "You haven't requested any leave yet."
                : `No ${filter} requests.`
            }
            action={
              all.length === 0 ? (
                <Button variant="primary" onClick={() => navigate("/requests/new")}>
                  New request
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/requests/${r.id}`)}
          />
        )}
      </Card>
    </>
  );
}
