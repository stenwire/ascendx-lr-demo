import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useWalkthrough } from "./WalkthroughContext";

const PADDING = 6;
const GAP = 12;
const TOOLTIP_WIDTH = 320;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readRect(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Walkthrough() {
  const { active, stepIndex, steps, next, back, stop } = useWalkthrough();
  const step = steps[stepIndex];
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<Rect | null>(null);

  // Move to the step's route first; the measure effect re-runs once we're there.
  useEffect(() => {
    if (!active || !step?.route) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [active, step, location.pathname, navigate]);

  // Measure after paint, and retry briefly: a step that navigates renders its
  // target a frame or two later.
  useLayoutEffect(() => {
    if (!active || !step) return;
    if (!step.target) {
      setRect(null);
      return;
    }

    let frame = 0;
    let attempts = 0;
    const measure = () => {
      const found = readRect(step.target!);
      if (found) {
        setRect(found);
        return;
      }
      if (attempts++ < 30) frame = requestAnimationFrame(measure);
      else setRect(null); // give up and show the step centred
    };
    measure();

    const onViewportChange = () => setRect(readRect(step.target!));
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [active, step, location.pathname]);

  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") stop();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, next, back, stop]);

  if (!active || !step) return null;

  const isLast = stepIndex === steps.length - 1;
  const cutout = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product walkthrough">
      {/* Dimmer. With a target, a huge ring draws the shade around the cutout so
          the element underneath stays visible and interactive-looking. */}
      {cutout ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-[9999px] ring-slate-900/60"
          style={{ top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/60" />
      )}

      {/* Click-off layer, behind the tooltip */}
      <button
        type="button"
        aria-label="Close walkthrough"
        onClick={stop}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <Tooltip
        cutout={cutout}
        title={step.title}
        body={step.body}
        stepIndex={stepIndex}
        total={steps.length}
        isLast={isLast}
        onNext={next}
        onBack={back}
        onSkip={stop}
      />
    </div>
  );
}

interface TooltipProps {
  cutout: Rect | null;
  title: string;
  body: string;
  stepIndex: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function Tooltip({ cutout, title, body, stepIndex, total, isLast, onNext, onBack, onSkip }: TooltipProps) {
  const [height, setHeight] = useState(0);
  const innerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (innerRef.current) setHeight(innerRef.current.offsetHeight);
  }, [title, body]);

  // Move focus to each new step so screen readers announce it and the arrow-key
  // handler works without the user clicking first.
  useEffect(() => {
    panelRef.current?.focus();
  }, [stepIndex]);

  const style = usePlacement(cutout, height);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="absolute rounded-card border border-slate-200 bg-white p-4 shadow-raised outline-none"
      style={style}
    >
      <div ref={innerRef}>
        <p className="font-mono text-[11px] tracking-wide text-slate-400">
          {stepIndex + 1} of {total}
        </p>
        <h2 className="mt-1 text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-600">{body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === stepIndex ? "bg-brand-500" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {stepIndex === 0 ? (
              <Button size="sm" variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            ) : (
              <Button size="sm" onClick={onBack}>
                Back
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={onNext}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Places the tooltip below the target, flipping above and clamping to the viewport. */
function usePlacement(cutout: Rect | null, tooltipHeight: number): React.CSSProperties {
  if (!cutout) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(${TOOLTIP_WIDTH}px, calc(100vw - 2rem))`,
    };
  }

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;
  const width = Math.min(TOOLTIP_WIDTH, viewportW - 32);
  const height = tooltipHeight || 180;

  const below = cutout.top + cutout.height + GAP;
  const fitsBelow = below + height <= viewportH - 16;
  const top = fitsBelow ? below : Math.max(16, cutout.top - GAP - height);

  // Centre on the target, then keep it fully on screen.
  const rawLeft = cutout.left + cutout.width / 2 - width / 2;
  const left = Math.min(Math.max(16, rawLeft), viewportW - width - 16);

  return { top, left, width };
}
