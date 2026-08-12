import type { CSSProperties } from "react";
import type { EventMode } from "../../lib/eventModes";
import { MODE_THEME } from "./modeTheme";

export type LedgerUpcoming = {
  id: string;
  name: string;
  mode: EventMode;
  modeLabel: string;
  dateLabel: string;
  /** e.g. "T−13 days" */
  tMinus: string;
  /** 0–8 armed step LEDs on the track row */
  stepsLit: number;
  ariaLabel: string;
};

export type LedgerPast = {
  id: string;
  name: string;
  modeLabel: string;
  dateLabel: string;
  ariaLabel: string;
};

/**
 * Upcoming events as armed sequencer tracks; past events as the engraved event
 * log. Both lists exclude the focal event (it lives on the display module and
 * the semester rail's live step).
 */
export function EventLedger({
  upcoming,
  past,
  onOpen,
}: {
  upcoming: LedgerUpcoming[];
  past: LedgerPast[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <section className="fi-h-zone" id="fi-h-upcoming" aria-labelledby="fi-h-upcoming-h">
        <header className="fi-h-zone-head">
          <h2 className="fi-zone fi-h-zone-word" id="fi-h-upcoming-h">
            Upcoming events
          </h2>
          <span className="fi-engraved">
            Sequencer · {String(upcoming.length).padStart(2, "0")} tracks armed
          </span>
        </header>
        {upcoming.length === 0 ? (
          <p className="fi-engraved">No tracks armed</p>
        ) : (
          <ol className="fi-h-tracks">
            {upcoming.map((e) => {
              const theme = MODE_THEME[e.mode];
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="fi-h-track"
                    aria-label={e.ariaLabel}
                    onClick={() => onOpen(e.id)}
                    style={{ "--c": theme.chassis, "--c-deep": theme.deep } as CSSProperties}
                  >
                    <span className="fi-h-track-led" aria-hidden="true" />
                    <span className="fi-h-track-name">{e.name}</span>
                    <span
                      className="fi-h-track-steps"
                      role="img"
                      aria-label={`${e.tMinus} — ${e.stepsLit} of 8 step LEDs lit`}
                    >
                      {Array.from({ length: 8 }, (_, i) => (
                        <span key={i} className={`fi-h-step${i < e.stepsLit ? " on" : ""}`} />
                      ))}
                    </span>
                    <span className="fi-h-track-dates">{e.dateLabel}</span>
                    <span className="fi-h-track-count">{e.tMinus}</span>
                    <span className="fi-h-track-mode">{e.modeLabel}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="fi-h-zone" id="fi-h-past" aria-labelledby="fi-h-past-h">
        <header className="fi-h-zone-head">
          <h2 className="fi-zone fi-h-zone-word" id="fi-h-past-h">
            Past events
          </h2>
          <span className="fi-engraved">
            Event log · {String(past.length).padStart(2, "0")} records
          </span>
        </header>
        {past.length === 0 ? (
          <p className="fi-engraved">No records yet</p>
        ) : (
          <div className="fi-h-log">
            {past.map((e) => (
              <button
                type="button"
                key={e.id}
                className="fi-h-log-row"
                aria-label={e.ariaLabel}
                onClick={() => onOpen(e.id)}
              >
                <span className="fi-h-log-date">{e.dateLabel}</span>
                <span className="fi-h-log-name">{e.name}</span>
                <span className="fi-h-log-mode">{e.modeLabel}</span>
                <span className="fi-h-log-status">Closed</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
