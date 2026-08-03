import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useIdentity } from "../auth/IdentityContext";
import { TOUR_STEPS, type TourStep } from "./steps";

const SEEN_KEY = "ascendx.tourSeen";

interface WalkthroughValue {
  active: boolean;
  stepIndex: number;
  steps: TourStep[];
  start: () => void;
  stop: () => void;
  next: () => void;
  back: () => void;
}

const WalkthroughContext = createContext<WalkthroughValue | null>(null);

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const { isManager, me } = useIdentity();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Manager-only stops are dropped rather than shown as dead ends.
  const steps = useMemo(() => TOUR_STEPS.filter((s) => !s.managerOnly || isManager), [isManager]);

  // Offer the tour once, after identity resolves so the step list is correct.
  useEffect(() => {
    if (!me) return;
    if (localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, "1");
    setStepIndex(0);
    setActive(true);
  }, [me]);

  const stop = useCallback(() => setActive(false), []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= steps.length - 1) {
        setActive(false);
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);

  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  const value = useMemo(
    () => ({ active, stepIndex, steps, start, stop, next, back }),
    [active, stepIndex, steps, start, stop, next, back],
  );

  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
}

export function useWalkthrough(): WalkthroughValue {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) throw new Error("useWalkthrough must be used inside WalkthroughProvider");
  return ctx;
}
