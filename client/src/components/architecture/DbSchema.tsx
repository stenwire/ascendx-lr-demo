interface SchemaColumn {
  name: string;
  type: string;
  notes?: string;
}

function SchemaTable({ table, columns }: { table: string; columns: SchemaColumn[] }) {
  return (
    <div>
      <p className="mb-2 font-mono text-xs font-semibold text-slate-700">{table}</p>
      <div className="overflow-x-auto rounded-control border border-slate-200">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100">
              <th className="px-4 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Column</th>
              <th className="px-4 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Type</th>
              <th className="px-4 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr key={col.name} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-slate-900">{col.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{col.type}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{col.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPLOYEE_COLUMNS: SchemaColumn[] = [
  { name: "id", type: "uuid", notes: "primary key" },
  { name: "name", type: "text" },
  { name: "email", type: "text", notes: "unique" },
  { name: "managerId", type: "uuid?", notes: "→ employees.id, self relation" },
  { name: "teamId", type: "text", notes: "indexed" },
  { name: "createdAt", type: "timestamp" },
];

const LEAVE_REQUEST_COLUMNS: SchemaColumn[] = [
  { name: "id", type: "uuid", notes: "primary key" },
  { name: "employeeId", type: "uuid", notes: "→ employees.id, indexed" },
  { name: "startDate", type: "date" },
  { name: "endDate", type: "date" },
  { name: "reason", type: "text" },
  { name: "managerNote", type: "text?" },
  { name: "status", type: "enum", notes: "pending, approved, or rejected. defaults to pending, indexed" },
  { name: "aiMessage", type: "text?", notes: "filled in on approval, or on retry after a provider failure" },
  { name: "decidedById", type: "uuid?", notes: "→ employees.id, who approved or rejected it" },
  { name: "createdAt", type: "timestamp" },
  { name: "decidedAt", type: "timestamp?" },
];

export function DbSchema() {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Two tables. Every question the app answers, who's on leave, who approved what, who reports to whom, is a
        query over these rows, not unstructured content, so I never reached for anything beyond plain relational
        tables.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <SchemaTable table="employees" columns={EMPLOYEE_COLUMNS} />
        <SchemaTable table="leave_requests" columns={LEAVE_REQUEST_COLUMNS} />
      </div>

      <dl className="space-y-3 border-t border-slate-100 pt-4">
        <div>
          <dt className="text-sm font-medium text-slate-900">Two foreign keys back to employees</dt>
          <dd className="mt-0.5 text-sm text-slate-600">
            A leave request always points at the employee it belongs to, and once decided, at whoever decided it.
            Both are plain foreign keys, not a role or permission of their own.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-900">One self relation</dt>
          <dd className="mt-0.5 text-sm text-slate-600">
            An employee optionally reports to another employee. That single column is what scopes a manager's
            approval queue and team view to their own reports, no separate roles table needed.
          </dd>
        </div>
      </dl>
    </div>
  );
}
