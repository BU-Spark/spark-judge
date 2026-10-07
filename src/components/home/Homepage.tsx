import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Toaster } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CodeAndTellVoteView } from "../code-and-tell/CodeAndTellVoteView";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { PlatformHeader } from "./PlatformHeader";
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

// Public event sites, separate from the judging routes used during live events.
const eventWebsites: Record<string, string> = {
  "DS+X 2026": "https://www.dsplusx.com/",
  "CivicHacks 2027": "https://civic-hacks.com/",
};

export function Homepage() {
  const events = useQuery(api.events.listEvents);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
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
      <PlatformHeader homepage />
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
                  <EventDescription event={event} />
                  {focal.phase === "live" && (
                    <Link className="hp-sign-in" to={`/event/${event._id}`}>
                      Open event <DirectionIcon />
                    </Link>
                  )}
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
                  <UpcomingEventRow key={event._id} event={event} />
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
      <Toaster position="bottom-right" />
    </div>
  );
}

function EventRowContent({ event }: { event: StageEvent }) {
  return (
    <>
      <span className="hp-date">{formatDate(event.startDate)}</span>
      <span className="hp-event-name">
        {event.name}
        <span>{getEventDisplayLabel(event.mode)}</span>
      </span>
    </>
  );
}

function EventRow({ event }: { event: StageEvent }) {
  return (
    <div className="hp-event-row">
      <EventRowContent event={event} />
    </div>
  );
}

function UpcomingEventRow({ event }: { event: StageEvent }) {
  return (
    <details className="hp-upcoming-event">
      <summary>
        <EventRowContent event={event} />
        <DirectionIcon direction="down" />
      </summary>
      <div className="hp-event-description">
        <EventDescription event={event} />
      </div>
    </details>
  );
}

function EventDescription({ event }: { event: StageEvent }) {
  const website = eventWebsites[event.name];
  return (
    <>
      <p>{event.description?.trim() || "More details coming soon."}</p>
      {website && (
        <a className="hp-event-website" href={website}>
          Visit {event.name} website <DirectionIcon />
        </a>
      )}
    </>
  );
}
