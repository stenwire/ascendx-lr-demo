import { useState } from "react";
import { toUserMessage } from "../lib/errorMessages";
import { resetDemoLeaveRequests } from "../api/client";
import { useIdentity } from "../auth/IdentityContext";
import { Button } from "./ui/Button";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Alert } from "./ui/States";

/**
 * Manager-only demo affordance: puts the sample leave requests back so the app
 * can be shown again from a known state. Destructive, so it asks first.
 */
export function DemoDataReset() {
  const { me, isManager } = useIdentity();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isManager || !me) return null;

  async function reset() {
    setError(null);
    setResult(null);
    setWorking(true);
    try {
      const { count } = await resetDemoLeaveRequests(me!.id);
      setResult(`Restored ${count} sample leave requests. Reload a page to see them.`);
      setConfirming(false);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Demo data"
        description="Put the sample leave requests back, so the app can be demonstrated from a known state."
      />
      <CardBody className="space-y-3">
        <p className="text-sm text-slate-600">
          This deletes every leave request and recreates the seeded set. Employees are left alone, so whoever you are
          signed in as stays signed in.
        </p>

        {confirming ? (
          <Alert tone="warning" title="Delete all leave requests?">
            Every request submitted since the last reset will be lost.
            <div className="mt-3 flex gap-2">
              <Button variant="danger" size="sm" onClick={reset} disabled={working}>
                {working ? "Restoring…" : "Yes, restore sample data"}
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)} disabled={working}>
                Cancel
              </Button>
            </div>
          </Alert>
        ) : (
          <Button onClick={() => setConfirming(true)}>Restore sample leave requests</Button>
        )}

        {result && <Alert tone="info">{result}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
      </CardBody>
    </Card>
  );
}
