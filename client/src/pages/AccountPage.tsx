import { useIdentity } from "../auth/IdentityContext";
import { initials } from "../components/layout/AccountMenu";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { CopyField } from "../components/ui/CopyField";
import { PageHeader } from "../components/ui/PageHeader";
import { Tabs } from "../components/ui/Tabs";

export function AccountPage() {
  const { me, employees, directReports, isManager } = useIdentity();
  if (!me) return null;

  const manager = employees.find((e) => e.id === me.managerId);
  const apiBase = window.location.origin.replace(":5173", ":4000");

  return (
    <>
      <PageHeader title="Account" description="Your profile, and the id the API identifies you by." />

      <Tabs
        items={[
          {
            id: "profile",
            label: "Profile",
            content: (
              <div className="max-w-3xl">
                <Card>
                  <CardBody>
                    <div className="flex items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700">
                        {initials(me.name)}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900">{me.name}</h2>
                        <p className="text-sm text-slate-500">
                          {isManager ? "Manager" : "Employee"} · Team {me.teamId}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Reports to</dt>
                        <dd className="mt-1 text-sm text-slate-900">{manager ? manager.name : "Nobody"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                          Direct reports
                        </dt>
                        <dd className="mt-1 text-sm text-slate-900">
                          {directReports.length > 0 ? directReports.map((r) => r.name).join(", ") : "None"}
                        </dd>
                      </div>
                    </dl>
                  </CardBody>
                </Card>
              </div>
            ),
          },
          {
            id: "api",
            label: "API access",
            content: (
              <div className="max-w-3xl">
                <Card>
                  <CardHeader
                    title="API access"
                    description="There is no login. The API resolves the current user from an x-employee-id header, so this id is your credential."
                  />
                  <CardBody className="space-y-5">
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-slate-700">Employee id</p>
                      <CopyField value={me.id} label="employee id" />
                    </div>

                    <div>
                      <p className="mb-1.5 text-sm font-medium text-slate-700">List your leave requests</p>
                      <CopyField
                        multiline
                        label="curl command"
                        value={`curl -H "x-employee-id: ${me.id}" \\\n  "${apiBase}/leave-requests?employee_id=${me.id}"`}
                      />
                    </div>

                    {isManager && (
                      <div>
                        <p className="mb-1.5 text-sm font-medium text-slate-700">List requests awaiting a decision</p>
                        <CopyField
                          multiline
                          label="curl command for pending queue"
                          value={`curl -H "x-employee-id: ${me.id}" \\\n  "${apiBase}/leave-requests?status=pending"`}
                        />
                      </div>
                    )}

                    <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
                      Full endpoint reference is at{" "}
                      <a
                        href={`${apiBase}/docs`}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer font-medium text-brand-700 hover:underline"
                      >
                        {apiBase}/docs
                      </a>
                      .
                    </p>
                  </CardBody>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
