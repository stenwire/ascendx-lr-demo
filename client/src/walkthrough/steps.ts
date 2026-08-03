export interface TourStep {
  /** Matched against `data-tour="…"`. Omit for a centred step with no target. */
  target?: string;
  title: string;
  body: string;
  /** Route to navigate to before showing this step. */
  route?: string;
  managerOnly?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "A quick tour",
    body: "Four stops to show you where things live. Use the arrow keys to move, or press Escape to leave at any point.",
    route: "/",
  },
  {
    target: "nav",
    title: "Navigation",
    body: "Each action has its own page. Approvals and Team only appear when the signed-in employee manages someone.",
    route: "/",
  },
  {
    target: "account",
    title: "Signing in as someone else",
    body: "There is no login. The API identifies you from an employee id in a header, so switching person here is the same as signing in as them — useful for seeing both sides of an approval.",
    route: "/",
  },
  {
    target: "approvals-queue",
    title: "Approving leave",
    body: "Approving normally generates a message for the employee. If it would leave the team short-staffed, the decision is held back and you are asked to confirm first.",
    route: "/approvals",
    managerOnly: true,
  },
  {
    target: "team-timeline",
    title: "Seeing conflicts early",
    body: "The timeline shows who is away over the next 30 days and highlights the days where cover drops below the threshold — so you can spot a clash before you approve it.",
    route: "/team",
    managerOnly: true,
  },
  {
    target: "help-link",
    title: "How it works",
    body: "The How it works page covers the AI and offline modes, the guardrails, and why things are built the way they are. You can replay this tour from there.",
    route: "/",
  },
];
