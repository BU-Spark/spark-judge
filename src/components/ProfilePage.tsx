import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, type CSSProperties } from "react";
import { formatDateTime } from "../lib/utils";
import {
  getEventDisplayLabel,
  getEventMode,
  type EventMode,
} from "../lib/eventModes";
import "./ProfilePage.fi.css";

interface ProfilePageProps {
  onSelectEvent: (eventId: Id<"events">) => void;
  onBackToLanding: () => void;
}

const MODE_ACCENT: Record<EventMode, string> = {
  hackathon: "var(--fi-teal)",
  code_and_tell: "var(--fi-blue)",
  demo_day: "var(--fi-green)",
};

function modeAccent(mode?: string | null): string {
  return MODE_ACCENT[getEventMode(mode)];
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function tMinusLabel(startDate: number | string | Date): string {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  if (Number.isNaN(start.getTime())) return "T−?";
  const now = new Date();
  const days = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "T−0 DAYS";
  return `T−${days} DAY${days === 1 ? "" : "S"}`;
}

export function ProfilePage({ onSelectEvent, onBackToLanding }: ProfilePageProps) {
  const profile = useQuery(api.users.getUserProfile);
  const [expandedPastEvents, setExpandedPastEvents] = useState(false);

  if (profile === undefined) {
    return (
      <div className="pp-loading" role="status" aria-live="polite">
        <div className="pp-spinner" aria-hidden="true" />
        <span className="fi-sr">Loading profile</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pp-page">
        <div className="fi-panel pp-idle">
          <div className="pp-idle-steps" aria-hidden="true">
            <span className="pp-idle-step" />
            <span className="pp-idle-step" />
            <span className="pp-idle-step" />
            <span className="pp-idle-step" />
          </div>
          <p className="fi-engraved pp-idle-copy">Not signed in · Sign in to view assignments</p>
          <p className="pp-idle-body">Please sign in to view your profile.</p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("hackjudge:open-signin"))}
            className="fi-key"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const { user, pastEvents, activeEvents, upcomingEvents, stats } = profile;

  return (
    <div className="pp-page">
      <header className="pp-header">
        <h1 className="pp-header-name">{user.name || "Anonymous Judge"}</h1>
        <div className="pp-header-stats">
          <span className="fi-readout">{pad2(stats.totalEvents)} events</span>
          <span className="fi-readout">{pad2(stats.totalTeamsScored)} teams scored</span>
        </div>
      </header>

      {activeEvents.length > 0 && (
        <section className="pp-zone" aria-labelledby="pp-active-h">
          <div className="pp-zone-head">
            <h2 className="fi-zone" id="pp-active-h">
              Active judging
            </h2>
            <span className="fi-engraved">
              {pad2(activeEvents.length)} live · resume scoring
            </span>
          </div>
          <div className="pp-active-list">
            {activeEvents.map(({ event, teamsJudged, scoresSubmitted }) => {
              const progressPercent =
                teamsJudged > 0
                  ? Math.round((scoresSubmitted / teamsJudged) * 100)
                  : 0;
              const isComplete = teamsJudged > 0 && scoresSubmitted >= teamsJudged * 0.8;
              const modeStyle = {
                ["--c" as string]: modeAccent(event.mode),
              } as CSSProperties;

              return (
                <article
                  key={event._id}
                  className="fi-module pp-active-module"
                  style={modeStyle}
                >
                  <div className="pp-active-status">
                    <span className="fi-chip pp-mode-chip">
                      {getEventDisplayLabel(event.mode)}
                    </span>
                    {isComplete && (
                      <span className="fi-chip pp-complete-chip">Complete</span>
                    )}
                  </div>
                  <h3 className="pp-active-name">{event.name}</h3>
                  <p className="fi-readout pp-active-progress">
                    {pad2(scoresSubmitted)} of {pad2(teamsJudged)}
                    {teamsJudged > 0 ? ` · ${progressPercent}%` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(event._id)}
                    className="fi-transport"
                  >
                    {scoresSubmitted > 0 ? "Resume scoring" : "Start scoring"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section className="pp-zone" aria-labelledby="pp-upcoming-h">
          <div className="pp-zone-head">
            <h2 className="fi-zone" id="pp-upcoming-h">
              Upcoming
            </h2>
            <span className="fi-engraved">
              Sequencer · {pad2(upcomingEvents.length)} tracks armed
            </span>
          </div>
          <ol className="pp-track-list">
            {upcomingEvents.map(({ event }) => {
              const modeStyle = {
                ["--c" as string]: modeAccent(event.mode),
              } as CSSProperties;

              return (
                <li key={event._id}>
                  <div className="pp-track" style={modeStyle}>
                    <span className="pp-track-led" aria-hidden="true" />
                    <h3 className="pp-track-name">{event.name}</h3>
                    <p className="fi-readout pp-track-dates">
                      {formatDateTime(event.startDate)} – {formatDateTime(event.endDate)}
                    </p>
                    <span className="fi-readout pp-track-count">
                      {tMinusLabel(event.startDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectEvent(event._id)}
                      className="fi-key fi-key--sm pp-track-action"
                    >
                      View details
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {pastEvents.length > 0 && (
        <section className="pp-zone" aria-labelledby="pp-past-h">
          <div className="pp-zone-head">
            <button
              type="button"
              id="pp-past-h"
              onClick={() => setExpandedPastEvents(!expandedPastEvents)}
              className="pp-zone-toggle"
              aria-expanded={expandedPastEvents}
            >
              <svg
                className={`pp-zone-chevron${expandedPastEvents ? " is-open" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="fi-zone">Completed</span>
            </button>
            <span className="fi-engraved">
              Event log · {pad2(pastEvents.length)} records
            </span>
          </div>

          {expandedPastEvents && (
            <div className="pp-ledger">
              {pastEvents.map(({ event, teamsJudged, scoresSubmitted }) => {
                const isComplete = teamsJudged > 0 && scoresSubmitted >= teamsJudged * 0.8;
                const skippedCount = teamsJudged - scoresSubmitted;

                return (
                  <div
                    key={event._id}
                    className="pp-ledger-row"
                    data-complete={isComplete ? "true" : "false"}
                  >
                    <div>
                      <h3 className="pp-ledger-name">{event.name}</h3>
                      <p className="fi-readout pp-ledger-meta">
                        {pad2(scoresSubmitted)}/{pad2(teamsJudged)} teams
                        {skippedCount > 0 && ` · ${skippedCount} skipped`}
                      </p>
                    </div>
                    <span className="fi-engraved-sm">
                      {getEventDisplayLabel(event.mode)}
                    </span>
                    <span className="fi-chip pp-closed-chip">Closed</span>
                    <button
                      type="button"
                      onClick={() => onSelectEvent(event._id)}
                      className="fi-key fi-key--sm pp-ledger-action"
                    >
                      View results
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeEvents.length === 0 &&
        upcomingEvents.length === 0 &&
        pastEvents.length === 0 && (
          <div className="fi-panel pp-idle">
            <div className="pp-idle-steps" aria-hidden="true">
              <span className="pp-idle-step" />
              <span className="pp-idle-step" />
              <span className="pp-idle-step" />
              <span className="pp-idle-step" />
              <span className="pp-idle-step" />
              <span className="pp-idle-step" />
              <span className="pp-idle-step" />
              <span className="pp-idle-step" />
            </div>
            <p className="fi-engraved pp-idle-copy">
              No assignments yet · Browse events
            </p>
            <button type="button" onClick={onBackToLanding} className="fi-key">
              Browse events
            </button>
          </div>
        )}
    </div>
  );
}
