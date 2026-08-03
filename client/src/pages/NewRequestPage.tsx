import { useState, type FormEvent } from "react";
import { toUserMessage } from "../lib/errorMessages";
import { useNavigate } from "react-router-dom";
import { createLeaveRequest } from "../api/client";
import { useIdentity } from "../auth/IdentityContext";
import { ArrowLeftIcon } from "../components/layout/icons";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { FormField, TextArea, TextInput } from "../components/ui/Form";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/States";
import { inclusiveDayCount, todayInputValue } from "../lib/dates";

export function NewRequestPage() {
  const { me } = useIdentity();
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mirrors the server's own validation so the user hears about it before a round trip.
  const rangeInvalid = Boolean(startDate && endDate && endDate < startDate);
  const dayCount = startDate && endDate && !rangeInvalid ? inclusiveDayCount(startDate, endDate) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (rangeInvalid) return;

    setError(null);
    setSubmitting(true);
    try {
      const leaveRequest = await createLeaveRequest(me!.id, { startDate, endDate, reason });
      navigate(`/requests/${leaveRequest.id}`);
    } catch (err) {
      setError(toUserMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => navigate("/requests")}
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        My requests
      </button>

      <PageHeader title="New request" description="Your manager will review this and approve or reject it." />

      <Card className="max-w-2xl">
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Start date" htmlFor="startDate">
                <TextInput
                  id="startDate"
                  type="date"
                  required
                  min={todayInputValue()}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FormField>

              <FormField
                label="End date"
                htmlFor="endDate"
                error={rangeInvalid ? "End date cannot be before the start date." : undefined}
                hint={dayCount ? `${dayCount} day${dayCount === 1 ? "" : "s"} of leave` : undefined}
              >
                <TextInput
                  id="endDate"
                  type="date"
                  required
                  min={startDate || todayInputValue()}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Reason" htmlFor="reason" hint="A short note for your manager.">
              <TextArea
                id="reason"
                required
                rows={3}
                maxLength={500}
                placeholder="Family holiday"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </FormField>

            {error && <Alert tone="error">{error}</Alert>}

            <div className="flex gap-2 border-t border-slate-200 pt-5">
              <Button type="submit" variant="primary" disabled={submitting || rangeInvalid}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
              <Button type="button" onClick={() => navigate("/requests")} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
