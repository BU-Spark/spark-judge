import { eventWebsites } from "../../lib/eventWebsites";
import { Suspense, useEffect, useRef, useState } from "react";
import { CodeAndTellVoteTest } from "@/devRoutes";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { PlatformToaster } from "../ui/PlatformToaster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CodeAndTellVoteView } from "../code-and-tell/CodeAndTellVoteView";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { PlatformHeader } from "./PlatformHeader";
import { EventCard, EventCardEmpty, EventCardSkeleton, UpcomingEventCard } from "./EventCard";
import { eventArtSequence, eventArtVariant } from "./EventCardArt";
import { getEventDisplayLabel } from "../../lib/eventModes";
import { CODE_AND_TELL_TITLE, CODE_AND_TELL_SUBTITLE } from "../../lib/codeAndTellPresentation";
import {
  groupHomepageEvents,
  selectFocalHomepage,
} from "../../lib/homepagePhase";
import type { StageEvent } from "./EventStage";
import { upcomingItems, type UpcomingItem } from "../../lib/upcomingEvents";
import "./homepage-workspace.css";

const UPCOMING_CARDS = 4;

const formatDate = (date: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);


export function Homepage({ voteTest = false }: { voteTest?: boolean }) {
  const VotingView = voteTest && CodeAndTellVoteTest ? CodeAndTellVoteTest : CodeAndTellVoteView;
  const homepageRef = useRef<HTMLDivElement>(null);
  const events = useQuery(api.events.listEvents);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const visibleEvents: StageEvent[] = [
    ...(events?.active ?? []),
    ...(events?.upcoming ?? []),
    ...(events?.past ?? []),
  ].filter((event) => !event.hidden);
  const groups = groupHomepageEvents<StageEvent>(visibleEvents, now);
  const focal = selectFocalHomepage(groups, now);
  const artSequence = focal ? eventArtSequence(visibleEvents, focal.event._id) : undefined;
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
      {voteTest ? (
        <header className="hp-header">
          <Link className="hp-brand" to="/vote-test">
            <img className="hp-brand-mark" src="/brand/hackjudge-mark.png" alt="" width={36} height={36} />
            HackJudge
          </Link>
          <div className="hp-header-actions">
            <a href="#past-events">Past events</a>
            <button className="hp-sign-in" onClick={() => window.location.reload()}>Reset test</button>
          </div>
        </header>
      ) : <PlatformHeader homepage />}
      <main>
        <section
          id="current-event"
          className={`hp-live-event${focal?.event.mode === "code_and_tell" ? " hp-live-event--code-and-tell" : " hp-live-event--card"}`}
          aria-label="Current event"
        >
          {events === undefined || (focal && event === undefined) ? (
            <EventCardSkeleton />
          ) : event && focal ? (
            focal.event.mode === "code_and_tell" ? (
              <Suspense fallback={<EventCardSkeleton />}>
                <VotingView
                  key={focal.event._id}
                  contextLabel={voteTest ? "Voting test · Nothing is saved" : "Current event"}
                  eventId={focal.event._id as Id<"events">}
                  event={event}
                  onBack={() =>
                    document
                      .getElementById("events")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                />
              </Suspense>
            ) : (
              <EventCard
                event={event}
                phase={focal.phase}
                now={now}
                artVariant={eventArtVariant(event._id, artSequence)}
              />
            )
          ) : (
            <EventCardEmpty hasPast={groups.past.length > 0} />
          )}
        </section>
        <section className="hp-directory" id="events" aria-label="Other events">
          {upcoming.length > 0 && (
            <>
              <div className="hp-directory-heading">
                <h2>Coming up</h2>
              </div>
              <UpcomingEvents events={upcoming} artEvents={visibleEvents} now={now} />
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
      <PlatformToaster />
    </div>
  );
}

/** Cards for the next few upcoming events, then rows for the rest. Demo Day award votes share one entry. */
export function UpcomingEvents({
  events,
  artEvents,
  now,
}: {
  events: StageEvent[];
  artEvents: StageEvent[];
  now: number;
}) {
  const items = upcomingItems(events);
  return (
    <>
      <div className="hp-upcoming-cards">
        {items.slice(0, UPCOMING_CARDS).map((item) => (
          <UpcomingEventCard
            key={item.key}
            event={item.event}
            now={now}
            title={item.title}
            label={item.label}
            awards={item.awards}
            artVariant={eventArtVariant(item.event._id, eventArtSequence(artEvents, item.event._id))}
          />
        ))}
      </div>
      {items.length > UPCOMING_CARDS && (
        <div className="hp-event-rows">
          {items.slice(UPCOMING_CARDS).map((item) => (
            <UpcomingEventRow key={item.key} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

function EventRowContent({
  event,
  title = event.mode === "code_and_tell" ? CODE_AND_TELL_TITLE : event.name,
  subtitle = event.mode === "code_and_tell" ? CODE_AND_TELL_SUBTITLE : getEventDisplayLabel(event.mode),
}: {
  event: StageEvent;
  title?: string;
  subtitle?: string;
}) {
  return (
    <>
      <span className="hp-date">{event.startDate > 0 ? formatDate(event.startDate) : "Date TBA"}</span>
      <span className="hp-event-name">
        <span className="hp-event-title">{title}</span>
        <span>{subtitle}</span>
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

function UpcomingEventRow({ item }: { item: UpcomingItem<StageEvent> }) {
  const { event, awards } = item;
  return (
    <details className="hp-upcoming-event">
      <summary>
        {awards ? (
          <EventRowContent event={event} title={item.label === item.title ? item.title : `${item.label} ${item.title}`} subtitle={awards.join(" and ")} />
        ) : (
          <EventRowContent event={event} title={item.title} subtitle={item.label} />
        )}
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
