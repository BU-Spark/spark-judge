import { Link } from "react-router-dom";
import { eventBrandClass } from "../../lib/eventBrands";
import { eventWebsites } from "../../lib/eventWebsites";
import { getEventDisplayLabel, getEventMode } from "../../lib/eventModes";
import type { FocalHomepage } from "../../lib/homepagePhase";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { EventCardArt } from "./EventCardArt";

const TIME_ZONE = "America/New_York";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: TIME_ZONE,
});
const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: TIME_ZONE,
});
const yearFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

type CardEvent = {
  _id: string;
  name: string;
  description?: string;
  startDate: number;
  endDate: number;
  mode?: string | null;
  tracks?: string[] | null;
  categories?: { name: string }[] | null;
  courseCodes?: string[] | null;
  teams?: unknown[] | null;
};

const MAX_CRITERIA = 6;

const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const cleanList = (values: (string | undefined | null)[] | null | undefined) =>
  Array.from(new Set((values ?? []).map((value) => value?.trim()).filter(Boolean) as string[]));

function sameDay(a: number, b: number) {
  return dayFormat.format(a) === dayFormat.format(b);
}

/** Days, hours, and minutes until a moment; days are dropped once under a day. */
function countdownParts(ms: number) {
  const remaining = Math.max(0, ms);
  const days = Math.floor(remaining / DAY);
  const hours = Math.floor((remaining % DAY) / HOUR);
  const minutes = Math.floor((remaining % HOUR) / 60_000);
  return [
    ...(days > 0 ? [{ value: days, unit: days === 1 ? "Day" : "Days" }] : []),
    { value: hours, unit: hours === 1 ? "Hour" : "Hours" },
    { value: minutes, unit: minutes === 1 ? "Minute" : "Minutes" },
  ];
}

function progress(phase: FocalHomepage["phase"], start: number | null, end: number | null, now: number) {
  if (phase === "pre") return 0;
  if (phase === "post" || start === null || end === null) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

function statusCopy(phase: FocalHomepage["phase"], start: number | null, end: number | null, now: number) {
  switch (phase) {
    case "pre":
      return { chip: "Upcoming", lead: "Starts in", target: start === null ? null : start - now, fallback: start === null ? "Date to be announced" : "Any moment now" };
    case "live":
      return { chip: "Live now", lead: "Ends in", target: end === null ? null : end - now, fallback: "Happening now" };
    case "post":
      return { chip: "Just wrapped", lead: "Ended", target: null, fallback: end === null ? "Recently" : dayFormat.format(end) };
  }
}

export function EventCard({
  event,
  phase,
  now,
  artVariant,
  liveAction = "Open event",
}: {
  event: CardEvent;
  phase: FocalHomepage["phase"];
  now: number;
  artVariant?: number;
  /** Label for the main button while the event is live, e.g. "Start judging" for a judge. */
  liveAction?: string;
}) {
  const website = eventWebsites[event.name];
  const mode = getEventMode(event.mode);
  const description = event.description?.trim();
  const tracks = mode === "demo_day" ? [] : cleanList(event.tracks);
  const courses = mode === "demo_day" ? cleanList(event.courseCodes) : [];
  const criteria = mode === "hackathon" ? cleanList(event.categories?.map((category) => category?.name)) : [];
  const projectCount = event.teams?.length ?? 0;
  const start = isTime(event.startDate) ? event.startDate : null;
  const end = isTime(event.endDate) && (start === null || event.endDate > start) ? event.endDate : null;
  const status = statusCopy(phase, start, end, now);
  const multiDay = start !== null && end !== null && !sameDay(start, end);
  const hasDetails = Boolean(description || tracks.length || courses.length || criteria.length);

  return (
    <article
      className={`hp-event-card hp-event-card--${phase}${eventBrandClass(event.name)}`}
      aria-labelledby="hp-event-card-title"
    >
      <EventCardArt seed={event._id} variant={artVariant} tiles={3} />
      <div className="hp-event-card-body">
        <p className="hp-event-card-eyebrow">
          <span className="hp-event-card-chip">
            <span className="hp-event-card-dot" aria-hidden="true" />
            <span>{status.chip}</span>
            <span className="hp-event-card-chip-format">{getEventDisplayLabel(event.mode)}</span>
          </span>
        </p>
        <h1 id="hp-event-card-title">{event.name}</h1>
        {description ? (
          <p className="hp-event-card-description">{description}</p>
        ) : (
          !hasDetails && (
            <p className="hp-event-card-description hp-event-card-description--empty">
              Details will be posted here as the event gets closer.
            </p>
          )
        )}

        <div className="hp-event-card-countdown">
          <span className="hp-event-card-label">{status.lead}</span>
          {status.target === null || status.target <= 0 ? (
            <span className="hp-event-card-countdown-ended">{status.fallback}</span>
          ) : (
            <span className="hp-event-card-countdown-value">
              {countdownParts(status.target).map((part) => (
                <span key={part.unit} className="hp-event-card-countdown-part">
                  <strong>{part.value}</strong> <span>{part.unit}</span>
                </span>
              ))}
            </span>
          )}
        </div>

        <div className="hp-event-card-schedule">
          {start !== null && end !== null && (
            <div className="hp-event-card-rail" aria-hidden="true">
              <span style={{ width: `${progress(phase, start, end, now) * 100}%` }} />
            </div>
          )}
          <dl>
            <div>
              <dt>{multiDay ? "Dates" : "Date"}</dt>
              <dd>
                {start === null
                  ? "To be announced"
                  : multiDay && end !== null
                    ? `${dayFormat.format(start)} – ${dayFormat.format(end)}, ${yearFormat.format(end)}`
                    : `${dayFormat.format(start)}, ${yearFormat.format(start)}`}
              </dd>
            </div>
            {start !== null && (
              <div>
                <dt>{multiDay ? "Kickoff" : "Time"}</dt>
                <dd>
                  {multiDay || end === null
                    ? `${timeFormat.format(start)} ET`
                    : `${timeFormat.format(start)} – ${timeFormat.format(end)} ET`}
                </dd>
              </div>
            )}
            {multiDay && end !== null && (
              <div>
                <dt>Wrap-up</dt>
                <dd>
                  {weekdayFormat.format(end)}, {timeFormat.format(end)} ET
                </dd>
              </div>
            )}
            {projectCount > 0 && (
              <div>
                <dt>Projects</dt>
                <dd>{projectCount}</dd>
              </div>
            )}
          </dl>
        </div>

        {(website || phase === "live") && (
          <div className="hp-event-card-actions">
            {phase === "live" && (
              <Link className="hp-event-card-primary" to={`/event/${event._id}`}>
                {liveAction} <DirectionIcon />
              </Link>
            )}
            {website && (
              <a
                className={phase === "live" ? "hp-event-card-secondary" : "hp-event-card-primary"}
                href={website}
              >
                {website.startsWith("https://www.eventbrite.com/")
                  ? "Register on Eventbrite"
                  : `Visit ${event.name} website`}{" "}
                <DirectionIcon />
              </a>
            )}
          </div>
        )}
      </div>

      {(tracks.length > 0 || courses.length > 0 || criteria.length > 0) && (
        <div className="hp-event-card-details">
          <PillGroup label="Tracks" items={tracks} />
          <PillGroup label="Courses" items={courses} />
          {criteria.length > 0 && (
            <div className="hp-event-card-group">
              <h2>Judged on</h2>
              <p className="hp-event-card-criteria">
                {[
                  ...criteria.slice(0, MAX_CRITERIA),
                  ...(criteria.length > MAX_CRITERIA ? [`+${criteria.length - MAX_CRITERIA} more`] : []),
                ].map((item, index) => (
                  <span key={item}>
                    {index > 0 && " · "}
                    <span className="hp-event-card-criterion">{item}</span>
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function PillGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="hp-event-card-group">
      <h2>{label}</h2>
      <ul className="hp-event-card-pills">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const SHORT_UNITS: Record<string, string> = {
  Day: "day",
  Days: "days",
  Hour: "hr",
  Hours: "hrs",
  Minute: "min",
  Minutes: "min",
};

/** Compact card for an event further out, sharing the focal card's art and series palette. */
export function UpcomingEventCard({
  event,
  now,
  artVariant,
  title = event.name,
  label = getEventDisplayLabel(event.mode),
  awards,
}: {
  event: Pick<CardEvent, "_id" | "name" | "startDate" | "mode">;
  now: number;
  artVariant?: number;
  title?: string;
  label?: string;
  awards?: string[];
}) {
  const website = eventWebsites[event.name];
  const start = isTime(event.startDate) ? event.startDate : null;
  const showYear = start !== null && yearFormat.format(start) !== yearFormat.format(now);
  const titleId = `hp-upcoming-${event._id}`;
  const days = start === null ? 0 : Math.round((start - now) / DAY);
  const countdown =
    start === null || start <= now
      ? []
      : days >= 7
        ? [{ value: days, unit: "Days" }]
        : countdownParts(start - now).slice(0, 2);

  return (
    <article className={`hp-upcoming-card hp-event-card--pre${eventBrandClass(event.name)}`} aria-labelledby={titleId}>
      <div className="hp-upcoming-card-inner">
        <EventCardArt seed={event._id} variant={artVariant} />
        <div className="hp-upcoming-card-body">
          <div className="hp-upcoming-card-head">
            <p className="hp-event-card-eyebrow">
              <span className="hp-event-card-chip">
                <span className="hp-event-card-dot" aria-hidden="true" />
                {label}
              </span>
            </p>
            <h3 id={titleId}>{title}</h3>
            {awards && awards.length > 0 && (
              <ul className="hp-upcoming-card-awards" aria-label="Awards">
                {awards.map((award) => (
                  <li key={award}>{award}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="hp-upcoming-card-rest">
            <p className="hp-upcoming-card-count">
              {countdown.length > 0 ? (
                <>
                  <span className="sr-only">Starts in </span>
                  {countdown.map((part) => (
                    <span key={part.unit}>
                      <strong>{part.value}</strong> {SHORT_UNITS[part.unit]}
                    </span>
                  ))}
                </>
              ) : (
                <span>{start === null ? "Date to be announced" : "Starting soon"}</span>
              )}
            </p>
            <div className="hp-upcoming-card-meta">
              {start !== null && (
                <time dateTime={new Date(start).toISOString()}>
                  {dayFormat.format(start)}
                  {showYear && `, ${yearFormat.format(start)}`}
                </time>
              )}
              {website && (
                <a href={website} aria-describedby={titleId}>
                  {website.startsWith("https://www.eventbrite.com/") ? "Register" : "Website"}
                  <DirectionIcon />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Placeholder with the card's shape so the page doesn't jump when data arrives. */
export function EventCardSkeleton() {
  return (
    <div className="hp-event-card hp-event-card--skeleton" role="status" aria-label="Loading events">
      <div className="hp-event-card-body">
        <span className="hp-skeleton hp-skeleton--chip" />
        <span className="hp-skeleton hp-skeleton--title" />
        <span className="hp-skeleton hp-skeleton--line" />
        <span className="hp-skeleton hp-skeleton--count" />
        <span className="hp-skeleton hp-skeleton--line hp-skeleton--short" />
      </div>
    </div>
  );
}

/** Shown when there is no current or upcoming event to feature. */
export function EventCardEmpty({ hasPast }: { hasPast: boolean }) {
  return (
    <div className="hp-event-card hp-event-card--empty">
      <EventCardArt seed="between-events" />
      <div className="hp-event-card-body">
        <p className="hp-event-card-eyebrow">
          <span className="hp-event-card-chip">
            <span className="hp-event-card-dot" aria-hidden="true" />
            Between events
          </span>
        </p>
        <h1>Nothing scheduled yet</h1>
        <p className="hp-event-card-description">
          The next hackathon, Demo Day, or Code &amp; Tell will appear here as soon as it&rsquo;s announced.
        </p>
        {hasPast && (
          <div className="hp-event-card-actions">
            <a className="hp-event-card-secondary" href="#past-events">
              Browse past events <DirectionIcon direction="down" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
