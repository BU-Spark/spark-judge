import { useState } from "react";
import { CodeAndTellPreview } from "../code-and-tell/CodeAndTellPreview";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { getStagePreview } from "../../lib/eventStagePreview";
import { getEventDisplayLabel } from "../../lib/eventModes";
import "./homepage-workspace.css";

export function HomepagePreview() {
  const [showControls, setShowControls] = useState(false);
  const [signedIn, setSignedIn] = useState(
    new URLSearchParams(window.location.search).get("signedIn") === "1",
  );
  const fixture = getStagePreview(
    new URLSearchParams({ mode: "code_and_tell", phase: "live" }),
  );
  const upcoming = fixture.events.filter(
    (event) => event.status === "upcoming",
  );
  const past = fixture.events.filter((event) => event.status === "past");
  const formatDate = (date: number) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  return (
    <div className={`hp-workspace${showControls ? " hp-show-controls" : ""}`}>
      <div className="hp-preview-bar">
        <span>Homepage preview · Sample events and projects</span>
        <button
          onClick={() => setShowControls((value) => !value)}
          aria-expanded={showControls}
        >
          {showControls ? "Hide preview controls" : "Change event stage"}
        </button>
      </div>
      <header className="hp-header">
        <a className="hp-brand" href="/homepage-preview">
          <img className="hp-brand-mark" src="/brand/hackjudge-mark.png" alt="" width={36} height={36} />
          HackJudge
        </a>
        <div className="hp-header-actions">
          <a href="#past-events">Past events</a>
          {signedIn ? (
            <details className="hp-account-menu">
              <summary>
                My account <DirectionIcon direction="down" />
              </summary>
              <div className="hp-account-panel">
                <span>preview@example.com</span>
                <button onClick={() => setSignedIn(false)}>Sign out</button>
              </div>
            </details>
          ) : (
            <button
              className="hp-sign-in"
              onClick={() => {
                setSignedIn(true);
                document
                  .getElementById("current-event")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Sign in <DirectionIcon />
            </button>
          )}
        </div>
      </header>
      <main>
        <section id="current-event" aria-label="Current event">
          <CodeAndTellPreview
            homepage
            authenticated={signedIn}
            onAuthenticationChange={setSignedIn}
          />
        </section>
        <section
          className="hp-directory"
          id="events"
          aria-labelledby="hp-events-title"
        >
          <div className="hp-directory-heading">
            <h2 id="hp-events-title">Coming up</h2>
          </div>
          <div className="hp-event-group">
            <h3>Next events</h3>
            <div className="hp-event-rows">
              {upcoming.map((event) => (
                <details key={event._id}>
                  <summary>
                    <span className="hp-date">
                      {formatDate(event.startDate)}
                    </span>
                    <span className="hp-event-name">
                      {event.name}
                      <span>{getEventDisplayLabel(event.mode)}</span>
                    </span>
                    <DirectionIcon direction="down" />
                  </summary>
                  <p>
                    {event.mode === "demo_day"
                      ? "Meet student projects and show the teams what you appreciate."
                      : "Bring your latest work, see the demos, and rank your favorites."}
                  </p>
                </details>
              ))}
            </div>
          </div>
          <div className="hp-archive" id="past-events">
            <div className="hp-archive-heading">
              <h3>Past events</h3>
              <span>Previous competitions & showcases</span>
            </div>
            <div className="hp-event-rows">
              {past.map((event) => (
                <details key={event._id}>
                  <summary>
                    <span className="hp-date">
                      {formatDate(event.startDate)}
                    </span>
                    <span className="hp-event-name">
                      {event.name}
                      <span>{getEventDisplayLabel(event.mode)}</span>
                    </span>
                    <DirectionIcon direction="down" />
                  </summary>
                  <p>This event has ended. Voting is closed.</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="hp-footer">
        <span>HackJudge</span>
        <span>Projects and the people behind them.</span>
        <a href="#current-event">
          Back to event <DirectionIcon direction="up" />
        </a>
      </footer>
    </div>
  );
}
