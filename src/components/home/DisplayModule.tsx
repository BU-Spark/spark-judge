import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { EventMode } from "../../lib/eventModes";
import { MODE_THEME } from "./modeTheme";

export type DisplayModulePhase = "pre" | "live" | "post" | null;

/**
 * The display module: dark glass screen with the authored scope animation on
 * one side, focal event readouts + transport on the other. Phase chips follow
 * the phase machine (ARMED / LIVE / REPLAY); the mode chip and live dot take
 * the focal event's mode color via the --c custom property.
 */
export function DisplayModule({
  name,
  description,
  mode,
  modeLabel,
  phase,
  formatLabel,
  meta,
  selectLine,
  transportLabel,
  onTransport,
  onAllEvents,
  extraActions = [],
}: {
  name: string;
  description?: string;
  mode: EventMode;
  modeLabel: string;
  phase: DisplayModulePhase;
  /** e.g. "48h format" */
  formatLabel?: string;
  meta: Array<[label: string, value: string]>;
  selectLine: ReactNode;
  transportLabel: string;
  onTransport: () => void;
  onAllEvents?: () => void;
  /** Secondary affordances (join as judge, add teams) rendered as ghost links. */
  extraActions?: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
}) {
  const theme = MODE_THEME[mode];
  return (
    <section
      className={`fi-h-face${onAllEvents ? " fi-h-face--docked" : ""}`}
      aria-labelledby="fi-h-event-name"
    >
      <div className="fi-h-module">
        <div className="fi-h-screen" aria-hidden="true">
          <ScopeCanvas />
          <span className="fi-h-screen-tag">{phase === null ? "SIG · STANDBY" : "SIG · LIVE FEED"}</span>
          <span className="fi-h-screen-tag fi-h-screen-tag--r">CH 01</span>
        </div>

        <div className="fi-h-info" style={{ "--c": theme.lit } as CSSProperties}>
          <div className="fi-h-status">
            {phase === "live" ? (
              <span className="fi-h-live-chip">
                <span className="fi-live-dot" aria-hidden="true" />
                LIVE
              </span>
            ) : phase === null ? (
              <span className="fi-h-chip">Standby</span>
            ) : (
              <span className="fi-h-chip">{phase === "pre" ? "Armed" : "Replay"}</span>
            )}
            <span className="fi-h-chip fi-h-chip--mode">Mode · {modeLabel}</span>
            {formatLabel && <span className="fi-h-chip">{formatLabel}</span>}
          </div>

          <h1 className="fi-h-event-name" id="fi-h-event-name">
            {name}
          </h1>
          {description && <p className="fi-h-event-desc">{description}</p>}

          <p className="fi-h-event-meta">
            {meta.map(([label, value]) => (
              <span key={label}>
                {label} <b>{value}</b>
              </span>
            ))}
          </p>

          <p className="fi-h-select-line" aria-live="polite">
            {selectLine}
          </p>

          <div className="fi-h-actions">
            {phase !== null && (
              <button type="button" className="fi-transport" onClick={onTransport}>
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2 1.5 10 6 2 10.5Z" fill="currentColor" />
                </svg>
                {transportLabel}
              </button>
            )}
            {extraActions.map((a) => (
              <button
                key={a.label}
                type="button"
                className="fi-h-ghost"
                onClick={a.onClick}
                disabled={a.disabled}
              >
                {a.label}
              </button>
            ))}
            {onAllEvents && (
              <button type="button" className="fi-h-ghost" onClick={onAllEvents}>
                All events
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Authored scope animation: orbit rings, orbiting signal dots, a center pulse,
 * and a dual waveform. Colors are read from the token layer at mount so the
 * canvas can never drift from DESIGN.md. Honors prefers-reduced-motion (draws
 * a single static frame) and pauses when the tab is hidden.
 */
function ScopeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tokens = getComputedStyle(document.documentElement);
    const TEAL = tokens.getPropertyValue("--fi-teal-phosphor").trim();
    const ORANGE = tokens.getPropertyValue("--fi-orange").trim();
    const WHITE = tokens.getPropertyValue("--fi-screen-ink").trim();
    const GRID = tokens.getPropertyValue("--fi-scope-grid").trim();
    const RING = tokens.getPropertyValue("--fi-screen-dim").trim();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function sizeCanvas() {
      if (!canvas || !canvas.parentElement) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    }

    function drawScope(t: number) {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      /* faint dot grid */
      ctx.fillStyle = GRID;
      const gap = Math.max(18, w / 22);
      for (let gx = gap / 2; gx < w; gx += gap) {
        for (let gy = gap / 2; gy < h; gy += gap) {
          ctx.fillRect(gx, gy, 1.4, 1.4);
        }
      }

      const cx = w * 0.5;
      const cy = h * 0.46;
      const base = Math.min(w, h);

      /* orbit rings */
      ctx.strokeStyle = RING;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      [0.34, 0.24, 0.14].forEach((f) => {
        ctx.beginPath();
        ctx.arc(cx, cy, base * f, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      /* orbiting dots: the live event's signal */
      const dots = [
        { r: 0.34, speed: 0.00022, size: 4.5, color: TEAL, phase: 0 },
        { r: 0.34, speed: 0.00022, size: 3, color: TEAL, phase: Math.PI },
        { r: 0.24, speed: -0.00034, size: 3.5, color: ORANGE, phase: 1.2 },
        { r: 0.14, speed: 0.00052, size: 2.6, color: WHITE, phase: 3.9 },
      ];
      dots.forEach((d) => {
        const a = d.phase + t * d.speed;
        const x = cx + Math.cos(a) * base * d.r;
        const y = cy + Math.sin(a) * base * d.r;
        ctx.beginPath();
        ctx.fillStyle = d.color;
        ctx.arc(x, y, d.size * (w / 700 + 0.6), 0, Math.PI * 2);
        ctx.fill();
      });

      /* center pulse */
      const pulse = reduceMotion ? 0.5 : (Math.sin(t * 0.0021) + 1) / 2;
      ctx.beginPath();
      ctx.fillStyle = TEAL;
      ctx.globalAlpha = 0.9;
      ctx.arc(cx, cy, 3 + pulse * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      /* waveforms along the bottom */
      const wy = h * 0.82;
      const amp = h * 0.07 * (0.55 + pulse * 0.45);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = TEAL;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y =
          wy +
          Math.sin((x / w) * Math.PI * 6 + t * 0.0026) * amp * Math.sin((x / w) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = ORANGE;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y =
          wy +
          Math.sin((x / w) * Math.PI * 10 - t * 0.0038) * amp * 0.45 * Math.sin((x / w) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    sizeCanvas();
    let raf = 0;
    if (reduceMotion) {
      drawScope(0);
    } else {
      const loop = (t: number) => {
        drawScope(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const onVisibility = () => {
      if (reduceMotion) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(function loop(t) {
          drawScope(t);
          raf = requestAnimationFrame(loop);
        });
      }
    };
    const onResize = () => {
      sizeCanvas();
      if (reduceMotion) drawScope(0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} />;
}
