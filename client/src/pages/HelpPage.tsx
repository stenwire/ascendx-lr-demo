import { DemoDataReset } from "../components/DemoDataReset";
import { FileStorageDiagram, LocalDevDiagram, ProductionDiagram } from "../components/architecture/DeploymentDiagrams";
import { DbSchema } from "../components/architecture/DbSchema";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Tabs } from "../components/ui/Tabs";
import { useWalkthrough } from "../walkthrough/WalkthroughContext";

function OverviewTab() {
  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader title="The flow" />
        <CardBody>
          <ol className="space-y-3">
            {[
              "An employee submits a leave request with dates and a reason.",
              "It appears in their manager's approval queue.",
              "The manager approves or rejects it. Approving also generates a short message for the employee; rejecting does not.",
              "If approving would leave the team short-staffed, nothing is applied until the manager confirms.",
            ].map((text, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-[11px] font-medium text-brand-700">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700">{text}</p>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Message generation: offline and AI modes"
          description="Set with AI_MODE in the server environment."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-control border border-slate-200 bg-slate-50 p-4">
              <p className="font-mono text-xs text-slate-500">AI_MODE=mock</p>
              <p className="mt-1 text-sm font-medium text-slate-900">Offline — the default</p>
              <p className="mt-1.5 text-sm text-slate-600">
                Messages come from a fixed template. No network calls, no API key, identical output every time — so
                the app can be run and reviewed without credentials, and tests stay deterministic.
              </p>
            </div>
            <div className="rounded-control border border-brand-200 bg-brand-50 p-4">
              <p className="font-mono text-xs text-brand-700">AI_MODE=live</p>
              <p className="mt-1 text-sm font-medium text-slate-900">Gemini via Google ADK</p>
              <p className="mt-1.5 text-sm text-slate-600">
                Needs a GEMINI_API_KEY. The model drafts the message; the surrounding checks and the fallback below
                behave the same either way.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            The mode falls back to offline automatically whenever no API key is set, so a missing key degrades the
            wording rather than breaking approvals.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Keeping generated text safe" />
        <CardBody>
          <dl className="space-y-4">
            {[
              [
                "Input checks",
                "The manager's optional note is the only untrusted free text that reaches the model. It's normalised and checked for prompt-injection and jailbreak patterns before it's used.",
              ],
              [
                "Output checks",
                "Responses are blocked if they leak internal detail, scrubbed for lesser issues, and capped in length.",
              ],
              [
                "Provider errors",
                "Timeouts, rate limits, and content blocks each map to a specific internal code and a fixed user-facing message — a raw provider error is never shown. Transient failures retry once.",
              ],
              [
                "Fallback",
                "Any unrecovered failure falls back to the default template. The approval itself always succeeds; only the wording degrades, and it can be regenerated later from the request's detail page.",
              ],
            ].map(([term, description]) => (
              <div key={term}>
                <dt className="text-sm font-medium text-slate-900">{term}</dt>
                <dd className="mt-0.5 text-sm text-slate-600">{description}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Decisions and trade-offs" />
        <CardBody>
          <dl className="space-y-4">
            {[
              [
                "No real login",
                "The API identifies you from an employee id in a header, and the account menu just changes which id is sent. Authorisation checks and scoping are written against the same shape a real auth layer would populate, so swapping one in wouldn't disturb the rest.",
              ],
              [
                "Staffing warning is a warning, not a block",
                "Approving past the threshold is allowed — the manager sees the shortfall and confirms. A hard block would be wrong for a rule this crude.",
              ],
              [
                "Rejections generate nothing",
                "A generated 'friendly' rejection reads worse than a plain status change, so the message only exists on approvals.",
              ],
              [
                "The team view fans out",
                "There's no team-scoped list endpoint, so the timeline requests each report's leave separately. Fine for a team this size; a real fix if a team got large.",
              ],
              [
                "Deliberately left out",
                "Caching, a settings dashboard, and editable templates. None are needed at this scale, and adding them would be building for a problem the app doesn't have.",
              ],
            ].map(([term, description]) => (
              <div key={term}>
                <dt className="text-sm font-medium text-slate-900">{term}</dt>
                <dd className="mt-0.5 text-sm text-slate-600">{description}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {/* Renders nothing unless the signed-in employee manages someone. */}
      <DemoDataReset />
    </div>
  );
}

function ArchitectureTab() {
  return (
    <div className="max-w-6xl space-y-4">
      <Card>
        <CardHeader
          title="Deployment"
          description="docker-compose.yml for dev, Dockerfile.prod for production. A fresh checkout gets the same infrastructure I actually run."
        />
        <CardBody className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Production</p>
            <ProductionDiagram />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Local development</p>
            <LocalDevDiagram />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Database" description="server/prisma/schema.prisma" />
        <CardBody>
          <DbSchema />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="File storage" />
        <CardBody className="space-y-5">
          <p className="text-sm text-slate-600">
            I don't store any files today. Every field on a leave request, dates, reason, manager note,
            AI-generated message, is plain text in Postgres. Nothing here has ever needed an upload, so I never
            built a storage layer for one. If that changed, a doctor's note attached to a request, say, here's the
            approach I'd take.
          </p>

          <FileStorageDiagram />

          <dl className="space-y-4 border-t border-slate-100 pt-4">
            {[
              [
                "No binaries in Postgres",
                "Keeps the database small, fast, and cheap to back up. The same reasoning that kept AI output as short generated text instead of something larger stored inline.",
              ],
              [
                "Stateless Express",
                "The production container has no persistent volume, anything written to local disk vanishes on redeploy. Presigned uploads sidestep that entirely.",
              ],
              [
                "Same trust boundary as the AI integration",
                "Express and Prisma stay the single source of truth for what a leave request is. Object storage, like the AI provider, is a bounded dependency I call out to and validate the result of, never one I defer judgment to.",
              ],
            ].map(([term, description]) => (
              <div key={term}>
                <dt className="text-sm font-medium text-slate-900">{term}</dt>
                <dd className="mt-0.5 text-sm text-slate-600">{description}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

export function HelpPage() {
  const { start } = useWalkthrough();

  return (
    <>
      <PageHeader
        title="How it works"
        description="What this app does, how the message generation behaves, and why it's built this way."
        action={
          <Button variant="primary" onClick={start}>
            Replay walkthrough
          </Button>
        }
      />

      <Tabs
        items={[
          { id: "overview", label: "Overview", content: <OverviewTab /> },
          { id: "architecture", label: "Architecture", content: <ArchitectureTab /> },
        ]}
      />
    </>
  );
}
