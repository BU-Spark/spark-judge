import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "react-router-dom";
import { Toaster } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CodeAndTellVoteView } from "../code-and-tell/CodeAndTellVoteView";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { SignInForm } from "../../SignInFormNew";
import { getEventDisplayLabel } from "../../lib/eventModes";
import {
  groupHomepageEvents,
  selectFocalHomepage,
} from "../../lib/homepagePhase";
import type { StageEvent } from "./EventStage";
import "./homepage-workspace.css";

const formatDate = (date: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);

export function Homepage() {
  const events = useQuery(api.events.listEvents);
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.events.isUserAdmin);
  const { signOut } = useAuthActions();
  const dialog = useRef<HTMLDialogElement>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (user) dialog.current?.close();
  }, [user]);
  const groups = groupHomepageEvents<StageEvent>(
    [
      ...(events?.active ?? []),
      ...(events?.upcoming ?? []),
      ...(events?.past ?? []),
    ].filter((event) => !event.hidden),
    now,
  );
  const focal = selectFocalHomepage(groups, now);
  const event = useQuery(
    api.events.getEvent,
    focal ? { eventId: focal.event._id as Id<"events"> } : "skip",
  );
  const upcoming = groups.upcoming.filter((e) => e._id !== focal?.event._id);
  return (
    <div className="hp-workspace">
      <header className="hp-header">
        <Link className="hp-brand" to="/">
          HackJudge
          <span className="hp-brand-dot" aria-hidden="true" />
        </Link>
        <div className="hp-header-actions">
          <a href="#past-events">Past events</a>
          {user ? (
            <details className="hp-account-menu">
              <summary>
                My account <DirectionIcon direction="down" />
              </summary>
              <div className="hp-account-panel">
                <span>{user.name || user.email}</span>
                <Link to="/profile">Profile</Link>
                {isAdmin && <Link to="/admin">Admin</Link>}
                <button onClick={() => void signOut()}>Sign out</button>
              </div>
            </details>
          ) : (
            <button
              className="hp-sign-in"
              disabled={user === undefined}
              onClick={() => dialog.current?.showModal()}
            >
              Sign in <DirectionIcon />
            </button>
          )}
        </div>
      </header>
      <main>
        <section
          id="current-event"
          className="hp-live-event"
          aria-label="Current event"
        >
          {events === undefined || (focal && event === undefined) ? (
            <p role="status" className="hp-loading">
              Loading events…
            </p>
          ) : event && focal ? (
            focal.event.mode === "code_and_tell" ? (
              <CodeAndTellVoteView
                eventId={focal.event._id as Id<"events">}
                event={event}
                onBack={() =>
                  document
                    .getElementById("events")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
            ) : (
              <div className="ct-workspace">
                <div className="ct-topline">
                  <span>
                    {formatDate(event.startDate)} ·{" "}
                    {getEventDisplayLabel(focal.event.mode)}
                  </span>
                </div>
                <header className="ct-masthead">
                  <h1>{event.name}</h1>
                </header>
                <section className="ct-stage-message">
                  <p>{event.description}</p>
                  <Link className="hp-sign-in" to={`/event/${event._id}`}>
                    Open event <DirectionIcon />
                  </Link>
                </section>
              </div>
            )
          ) : (
            <p className="hp-loading">No upcoming events yet.</p>
          )}
        </section>
        <section className="hp-directory" id="events" aria-label="Other events">
          {upcoming.length > 0 && (
            <>
              <div className="hp-directory-heading">
                <h2>Coming up</h2>
              </div>
              <div className="hp-event-rows">
                {upcoming.map((event) => (
                  <EventRow key={event._id} event={event} />
                ))}
              </div>
            </>
          )}
          <div className="hp-archive" id="past-events">
            <div className="hp-archive-heading">
              <h3>Past events</h3>
              <span>Previous competitions &amp; showcases</span>
            </div>
            <div className="hp-event-rows">
              {groups.past.map((event) => (
                <EventRow key={event._id} event={event} />
              ))}
            </div>
            {groups.past.length === 0 && <p>No past events yet.</p>}
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
      <dialog
        ref={dialog}
        className="hp-auth-dialog"
        aria-labelledby="homepage-sign-in-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div>
          <button
            className="hp-dialog-close"
            aria-label="Close sign in"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
          <h2 id="homepage-sign-in-title">Sign in</h2>
          <SignInForm />
        </div>
      </dialog>
      <Toaster position="bottom-right" />
    </div>
  );
}

function EventRow({ event }: { event: StageEvent }) {
  return (
    <Link className="hp-event-link" to={`/event/${event._id}`}>
      <span className="hp-date">{formatDate(event.startDate)}</span>
      <span className="hp-event-name">
        {event.name}
        <span>{getEventDisplayLabel(event.mode)}</span>
      </span>
      <DirectionIcon />
    </Link>
  );
}
