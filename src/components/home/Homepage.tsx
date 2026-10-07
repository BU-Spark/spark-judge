import { eventWebsites } from "../../lib/eventWebsites";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Toaster } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CodeAndTellVoteView } from "../code-and-tell/CodeAndTellVoteView";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { PlatformHeader } from "./PlatformHeader";
import { getEventDisplayLabel } from "../../lib/eventModes";
import { CODE_AND_TELL_TITLE, CODE_AND_TELL_SUBTITLE } from "../../lib/codeAndTellPresentation";
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
  const homepageRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    const root = homepageRef.current;
    const header = root?.querySelector<HTMLElement>(".hp-header");
    if (!root || !header) return;
    const measure = () => {
      root.style.setProperty("--hp-header-height", `${header.getBoundingClientRect().height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [event?._id]);
  return (
    <div className="hp-workspace" id="top" ref={homepageRef}>
      <PlatformHeader homepage />
      <main>
        <section
          id="current-event"
          className={`hp-live-event${focal?.event.mode === "code_and_tell" ? " hp-live-event--code-and-tell" : ""}`}
          aria-label="Current event"
        >
          {events === undefined || (focal && event === undefined) ? (
            <p role="status" className="hp-loading">
              Loading events…
            </p>
          ) : event && focal ? (
            focal.event.mode === "code_and_tell" ? (
              <CodeAndTellVoteView
                contextLabel="Current event"
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
        <a href="#top">
          Back to top <DirectionIcon direction="up" />
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
        <span className="hp-event-title">{event.mode === "code_and_tell" ? CODE_AND_TELL_TITLE : event.name}</span>
        <span>{event.mode === "code_and_tell" ? CODE_AND_TELL_SUBTITLE : getEventDisplayLabel(event.mode)}</span>
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
          {website.startsWith("https://www.eventbrite.com/")
            ? "Register on Eventbrite"
            : `Visit ${event.name} website`} <DirectionIcon />
        </a>
      )}
    </>
  );
}
