import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { EventMode } from "../../lib/eventModes";
import { MODE_JACK_X, MODE_THEME } from "./modeTheme";

export type RailEvent = {
  id: string;
  name: string;
  mode: EventMode;
  modeLabel: string;
  /** ms timestamps used only for window math + x position */
  startDate: number;
  endDate: number;
  relation: "past" | "focal" | "next";
  /** Short label hung under the step, e.g. "May 24" */
  dateLabel: string;
  /** Full date range for the tooltip, e.g. "May 24 – May 26" */
  dateRangeLabel: string;
  /** Status word for the tooltip, e.g. "Live now", "Armed", "Closed" */
  statusLabel: string;
  ariaLabel: string;
  /** Focal step sub-tag, e.g. "Live" — hidden on narrow screens */
  focalTag?: string;
};

export type RailPhase = "live" | "pre" | "post" | null;

type MonthMark = { label: string; pct: number };

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Steps closer than this share one date row — the later one staggers low. */
const STAGGER_PCT = 2;

function pct(t: number, w0: number, w1: number): number {
  if (w1 <= w0) return 50;
  return Math.min(99.4, Math.max(0.6, ((t - w0) / (w1 - w0)) * 100));
}

/**
 * The semester rail: the display module's time axis on a rolling window
 * (−3 → +3 months around today). Past events sit on the rule as filled spent
 * steps, upcoming as outlined armed steps in their mode color, and the phase
 * winner is patched to the module above by a curved lead to its mode's input
 * jack — solid for live, hollow for armed (pre), dimmed for replay. In standby
 * there is no lead: a quiet NOW hairline marks today. Lead geometry is measured
 * from real layout so it stays true at any viewport.
 */
export function SemesterRail({
  events,
  focalId,
  phase,
  now,
  onOpen,
}: {
  events: RailEvent[];
  focalId: string | null;
  phase: RailPhase;
  /** Current time in ms — drives the rolling window and elapsed fill. */
  now: number;
  onOpen: (id: string) => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const focalRef = useRef<HTMLLIElement>(null);
  const [patch, setPatch] = useState<{ d: string; jackX: number; viewW: number; viewH: number } | null>(null);

  const sorted = [...events].sort((a, b) => a.startDate - b.startDate);
  const standby = phase === null;
  const focal = standby ? null : (sorted.find((e) => e.id === focalId) ?? null);

  /* Rolling window: −3 months → +3 months around now. */
  const w0Date = new Date(now);
  w0Date.setUTCMonth(w0Date.getUTCMonth() - 3);
  const w1Date = new Date(now);
  w1Date.setUTCMonth(w1Date.getUTCMonth() + 3);
  const w0 = w0Date.getTime();
  const w1 = w1Date.getTime();

  /* Only events intersecting the window render as steps; the rest live in the ledger. */
  const visible = sorted.filter((e) => e.endDate >= w0 && e.startDate <= w1);

  /* Month marks at each month boundary inside the window. */
  const months: MonthMark[] = [];
  {
    const cursor = new Date(w0);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    if (cursor.getTime() < w0) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    while (cursor.getTime() <= w1) {
      months.push({ label: MONTH_SHORT[cursor.getUTCMonth()]!, pct: pct(cursor.getTime(), w0, w1) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  const rangeLabel = `Track 00 · ${months[0]?.label ?? ""}–${months[months.length - 1]?.label ?? ""} ${new Date(now).getUTCFullYear()} · ${String(visible.length).padStart(2, "0")} events`;

  /* Steps within ~2% share a date row — stagger every other colliding one low. */
  const xOf = new Map<string, number>();
  const lowSet = new Set<string>();
  let lastX = Number.NEGATIVE_INFINITY;
  let lastLow = false;
  for (const e of visible) {
    const x = pct(e.startDate, w0, w1);
    xOf.set(e.id, x);
    if (x - lastX < STAGGER_PCT && !lastLow) {
      lowSet.add(e.id);
      lastLow = true;
    } else {
      lastLow = false;
    }
    lastX = x;
  }

  /* Elapsed fill along the rule for a live focal event. */
  const fill =
    focal && phase === "live"
      ? { left: pct(focal.startDate, w0, w1), width: Math.max(0, pct(now, w0, w1) - pct(focal.startDate, w0, w1)) }
      : null;

  const routePatch = useCallback(() => {
    const section = sectionRef.current;
    const li = focalRef.current;
    if (!section || !li || !focal) return;
    const sr = section.getBoundingClientRect();
    const lr = li.getBoundingClientRect();
    const padX = parseFloat(getComputedStyle(section).paddingLeft) || 0;
    const x = lr.left - sr.left + lr.width / 2;
    const stepTop = lr.top - sr.top;
    const jackX = padX + MODE_JACK_X[focal.mode];
    const runY = 56;
    const dir = x >= jackX ? 1 : -1;
    const r = Math.max(2, Math.min(16, Math.abs(x - jackX) / 2 - 2));
    const d =
      `M ${x} ${stepTop - 2} ` +
      `L ${x} ${runY + r} ` +
      `Q ${x} ${runY} ${x - dir * r} ${runY} ` +
      `L ${jackX + dir * r} ${runY} ` +
      `Q ${jackX} ${runY} ${jackX} ${runY - r} ` +
      `L ${jackX} 2`;
    setPatch({ d, jackX, viewW: sr.width, viewH: sr.height });
  }, [focal]);

  useLayoutEffect(() => {
    routePatch();
    const section = sectionRef.current;
    if (!section) return;
    const ro = new ResizeObserver(routePatch);
    ro.observe(section);
    window.addEventListener("resize", routePatch);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", routePatch);
    };
  }, [routePatch]);

  const focalTheme = focal ? MODE_THEME[focal.mode] : null;

  return (
    <section
      className="fi-h-zone fi-h-semester"
      aria-labelledby="fi-h-semester-h"
      ref={sectionRef}
    >
      <h2 className="fi-sr" id="fi-h-semester-h">
        Semester rail
      </h2>

      <div className="fi-h-trace" aria-hidden="true">
        <span className="fi-engraved fi-h-chan fi-h-chan--l">Semester</span>
        <span className="fi-engraved fi-h-chan fi-h-chan--r">{rangeLabel}</span>
      </div>

      {focal && focalTheme && patch && (
        <div
          className={`fi-h-patch${phase === "pre" ? " fi-h-patch--hollow" : ""}${phase === "post" ? " fi-h-patch--dim" : ""}`}
          aria-hidden="true"
          style={{ "--c": focalTheme.chassis } as CSSProperties}
        >
          <svg viewBox={`0 0 ${patch.viewW} ${patch.viewH}`}>
            <path
              d={patch.d}
              fill="none"
              stroke={focalTheme.chassis}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div
            className={`fi-h-pjack${phase === "pre" ? " fi-h-pjack--hollow" : ""}${phase === "post" ? " fi-h-pjack--dim" : ""}`}
            style={{ left: `${patch.jackX}px` }}
          />
        </div>
      )}

      <div className="fi-h-lane">
        <div className="fi-h-lane-bed">
          <span className="fi-h-lane-rule" aria-hidden="true" />
          {fill && focalTheme && (
            <span
              className="fi-h-lane-fill"
              aria-hidden="true"
              style={{ left: `${fill.left}%`, width: `${fill.width}%`, "--c": focalTheme.chassis } as CSSProperties}
            />
          )}
          {months.map((m, i) => (
            <span
              key={`m-${m.label}-${i}`}
              className={`fi-engraved fi-h-lane-month${i === 0 ? " first" : ""}${i === months.length - 1 ? " last" : ""}`}
              style={{ left: `${m.pct}%` }}
              aria-hidden="true"
            >
              {m.label}
            </span>
          ))}
          {months.map((m, i) => (
            <span
              key={`t-${m.label}-${i}`}
              className="fi-h-lane-tick"
              style={{ left: `${m.pct}%` }}
              aria-hidden="true"
            />
          ))}
          <ol className="fi-h-lane-evs">
            {visible.map((e) => {
              const theme = MODE_THEME[e.mode];
              const isFocal = e.id === focalId;
              const isNow = e.id === "__now";
              const stepClass = isNow
                ? "fi-h-lane-step fi-h-lane-step--now"
                : isFocal
                  ? `fi-h-lane-step fi-h-lane-step--live${phase === "live" ? " fi-h-lane-step--pulse" : ""}${phase === "pre" ? " fi-h-lane-step--armed" : ""}${phase === "post" ? " fi-h-lane-step--dim" : ""}`
                  : e.relation === "past"
                    ? "fi-h-lane-step fi-h-lane-step--past"
                    : "fi-h-lane-step fi-h-lane-step--next";
              return (
                <li
                  key={e.id}
                  ref={isFocal ? focalRef : undefined}
                  className={lowSet.has(e.id) ? "low" : undefined}
                  style={
                    {
                      "--x": `${xOf.get(e.id)}%`,
                      "--c": theme.chassis,
                      "--c-deep": theme.deep,
                    } as CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="fi-h-lane-ev"
                    aria-label={e.ariaLabel}
                    aria-current={isFocal ? "true" : undefined}
                    onClick={() => onOpen(e.id)}
                  >
                    <span className={stepClass} aria-hidden="true" />
                    <span
                      className={`fi-engraved fi-h-lane-date${isFocal && !isNow ? " fi-h-lane-date--live" : ""}`}
                      aria-hidden="true"
                    >
                      {e.dateLabel}
                      {isFocal && e.focalTag && (
                        <span className="fi-h-lane-live-tag"> · {e.focalTag}</span>
                      )}
                    </span>
                    <span className="fi-h-lane-tip" aria-hidden="true">
                      <span className="fi-h-lane-tip-name">{e.name}</span>
                      <span className="fi-h-lane-tip-meta">
                        {e.modeLabel} · {e.dateRangeLabel} · {e.statusLabel}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
