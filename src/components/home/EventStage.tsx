import { useId } from "react";
import { getEventDisplayLabel, getEventMode } from "../../lib/eventModes";
import type { HomepageEvent } from "../../lib/homepagePhase";
import { formatDateRangeSimple } from "../../lib/utils";

type Phase = "pre" | "live" | "post";
export type StageEvent = HomepageEvent & {
  description?: string;
  teamCount?: number;
  resultsReleased?: boolean;
  hasRankedVote?: boolean;
  userRole?: { role?: string } | null;
  requiresJudgeCode?: boolean;
  scoringLockedAt?: number;
  tracks?: string[];
  courseCodes?: string[];
  categories?: Array<string | { name: string; weight?: number }>;
};
export type StageProject = {
  _id: string;
  name: string;
  description?: string;
  track?: string;
  hidden?: boolean;
};
type Props = {
  focal: { event: StageEvent; phase: Phase } | null;
  events: { active: StageEvent[]; upcoming: StageEvent[]; past: StageEvent[] };
  projects?: StageProject[];
  loading: boolean;
  now: number;
  demo: boolean;
  notice?: string;
  onSelectLive: (id: string) => void;
  onOpenEvent: (id: string) => void;
  onParticipate: () => void;
  onOpenProject: (project: StageProject) => void;
  extraAction?: { label: string; disabled?: boolean; onClick: () => void };
  onAddTeams?: () => void;
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"} />
    </svg>
  );
}

/** Abstract, decorative geometry. Not a screenshot or an inferred project logo. */
export function ProjectArt({
  index,
  compact = false,
}: {
  index: number;
  compact?: boolean;
}) {
  const clip = useId();
  return (
    <svg
      className={`es-art${compact ? " es-art--small" : ""}`}
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <rect width="400" height="240" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path fill="var(--es-evergreen)" d="M0 0h400v240H0z" />
        {index % 4 === 0 ? (
          <>
            <circle cx="115" cy="120" r="112" fill="var(--es-citron)" />
            <path
              d="M100 240 340 0h60v240Z"
              fill="var(--es-art-strong, var(--es-cobalt))"
            />
            <path d="M0 135h115v105H0z" fill="var(--es-teal)" />
          </>
        ) : index % 4 === 1 ? (
          <>
            <path
              d="M190 240C60 240 36 140 36 50c108 0 154 88 154 190Z"
              fill="var(--es-citron)"
            />
            <path
              d="M194 240c0-115 74-182 175-182 0 108-82 182-175 182Z"
              fill="var(--es-citron)"
            />
            <circle
              cx="207"
              cy="46"
              r="38"
              fill="var(--es-art-light, var(--es-lilac))"
            />
            <path d="M365 0h16v240h-16z" fill="var(--es-yellow)" />
          </>
        ) : index % 4 === 2 ? (
          <>
            <path
              d="M0 0h400v240H0z"
              fill="var(--es-art-light, var(--es-lilac))"
            />
            <path
              d="M0 0h165v100H65v140H0zM265 140h135v100H165V140h100V0h100v140z"
              fill="var(--es-art-strong, var(--es-cobalt))"
            />
            <path d="M145 80h65v80h-65z" fill="var(--es-citron)" />
          </>
        ) : (
          <>
            <path
              d="M0 0h400v240H0z"
              fill="var(--es-art-light, var(--es-lilac))"
            />
            <circle
              cx="140"
              cy="125"
              r="110"
              fill="var(--es-art-strong, var(--es-cobalt))"
            />
            <path d="M220 15a110 110 0 0 0 0 220Z" fill="var(--es-citron)" />
            <path d="m300 240 100-130v130Z" fill="var(--es-teal)" />
          </>
        )}
      </g>
    </svg>
  );
}

const intro = {
  hackathon: {
    pre: "The next ideas are taking shape.",
    live: "Good ideas deserve a closer look.",
    post: "A look back at what was built.",
  },
  demo_day: {
    pre: "A semester of work. A day to share it.",
    live: "Find a project that speaks to you.",
    post: "The projects live on.",
  },
  code_and_tell: {
    pre: "New work. Fresh perspectives.",
    live: "Take a look. Make your picks.",
    post: "Thanks for sharing your favorites.",
  },
};

export function stageAction(event: StageEvent, phase: Phase) {
  const mode = getEventMode(event.mode);
  if (phase === "post")
    return event.resultsReleased ? "View results" : "View projects";
  if (phase === "pre") return "Explore the event";
  if (mode === "demo_day") return "Browse & appreciate";
  if (mode === "code_and_tell")
    return event.hasRankedVote ? "Edit your ballot" : "Start your ballot";
  if (event.scoringLockedAt) return "View event";
  return event.userRole?.role === "participant"
    ? "Open event"
    : "Start judging";
}

function ProjectList({
  projects,
  onOpen,
}: {
  projects: StageProject[];
  onOpen: Props["onOpenProject"];
}) {
  return (
    <ul className="es-project-list">
      {projects.map((p, i) => (
        <li key={p._id}>
          <button onClick={() => onOpen(p)} className="es-project-row">
            <ProjectArt index={i} compact />
            <span className="es-project-copy">
              <strong>{p.name}</strong>
              <span>{p.track || p.description || "View project"}</span>
            </span>
            <span className="es-project-arrow">
              <Arrow diagonal />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EventStage({
  focal,
  events,
  projects,
  loading,
  now,
  demo,
  notice,
  onSelectLive,
  onOpenEvent,
  onParticipate,
  onOpenProject,
  extraAction,
  onAddTeams,
}: Props) {
  const mode = getEventMode(focal?.event.mode);
  const visibleProjects = (projects ?? [])
    .filter((p) => !p.hidden)
    .slice(0, mode === "demo_day" ? 4 : 5);
  const categories = (focal?.event.categories ?? []).map((c) =>
    typeof c === "string" ? c : c.name,
  );
  const future = events.upcoming.filter((e) => e._id !== focal?.event._id);
  const past = events.past.filter((e) => e._id !== focal?.event._id);
  const phase = focal?.phase ?? "pre";
  const date = focal
    ? formatDateRangeSimple(focal.event.startDate, focal.event.endDate)
    : "";
  const status =
    phase === "live"
      ? "Happening now"
      : phase === "post"
        ? "Event recap"
        : "Up next";
  const emptyProjects = projects !== undefined && visibleProjects.length === 0;
  const title =
    phase === "post"
      ? "From the event"
      : mode === "hackathon"
        ? "Meet the projects"
        : mode === "demo_day"
          ? "Explore the projects"
          : "Find your favorites";

  return (
    <div className={`event-stage es-${mode}`}>
      {demo && (
        <div className="es-preview-note">
          <span>Design preview · Sample events and projects</span>
          <a href="/">
            Go to live homepage <Arrow />
          </a>
        </div>
      )}
      {notice && (
        <p className="es-notice" role="status">
          {notice}
        </p>
      )}
      {events.active.length > 1 && (
        <div className="es-overlap">
          <p>{events.active.length} events are happening now</p>
          <div role="group" aria-label="Choose a live event">
            {events.active.map((event) => (
              <button
                key={event._id}
                aria-pressed={event._id === focal?.event._id}
                onClick={() => onSelectLive(event._id)}
              >
                {event.name}
                <Arrow />
              </button>
            ))}
          </div>
        </div>
      )}
      {loading ? (
        <section className="es-empty" aria-busy="true">
          <h1>Getting the next event ready.</h1>
          <p role="status">Loading events…</p>
        </section>
      ) : !focal ? (
        <section className="es-empty">
          <h1>Room for the next big idea.</h1>
          <p>
            There are no upcoming events yet. Check back for the next hackathon,
            Demo Day, or Code &amp; Tell.
          </p>
          <a href="#event-calendar" className="es-button">
            Explore past events <Arrow />
          </a>
        </section>
      ) : (
        <section
          className={`es-stage es-phase-${phase}`}
          key={`${focal.event._id}-${phase}`}
          aria-labelledby="featured-title"
        >
          <div className="es-event-line">
            <span>
              <span className={`es-status-dot es-status-${phase}`} />
              {status}
            </span>
            <span>{date}</span>
            <a href="#event-calendar">
              Event calendar <Arrow diagonal />
            </a>
          </div>
          <div className="es-stage-grid">
            <div className="es-introduction">
              <h1 id="featured-title">{focal.event.name}</h1>
              <p className="es-event-format">
                {getEventDisplayLabel(mode)}
                <span aria-hidden="true"> / </span>
                {phase === "live"
                  ? "Open now"
                  : phase === "post"
                    ? "Wrapped up"
                    : new Intl.DateTimeFormat("en-US", {
                        month: "long",
                        day: "numeric",
                      }).format(focal.event.startDate)}
              </p>
              <p className="es-description">
                {phase === "post"
                  ? intro[mode].post
                  : focal.event.description || intro[mode][phase]}
              </p>
              <button className="es-button es-primary" onClick={onParticipate}>
                {stageAction(focal.event, phase)}
                <Arrow />
              </button>
              {phase === "pre" && (
                <p className="es-action-note">
                  {mode === "demo_day"
                    ? "Appreciations begin"
                    : mode === "hackathon"
                      ? "Judging begins"
                      : "Voting begins"}{" "}
                  when the event opens.
                </p>
              )}
              {phase === "post" && (
                <p className="es-action-note">
                  {focal.event.resultsReleased
                    ? "Results are available. Thanks for taking part."
                    : "The event has ended. Results have not been released."}
                </p>
              )}
              {focal.event.scoringLockedAt &&
              mode === "hackathon" &&
              phase === "live" ? (
                <p className="es-action-note">
                  Scoring is closed. You can still explore the projects.
                </p>
              ) : null}
              <div className="es-secondary-actions">
                {extraAction && !focal.event.scoringLockedAt && (
                  <button
                    disabled={extraAction.disabled}
                    onClick={extraAction.onClick}
                  >
                    {extraAction.label}
                    <Arrow />
                  </button>
                )}
                {onAddTeams && (
                  <button onClick={onAddTeams}>
                    Add teams
                    <Arrow />
                  </button>
                )}
              </div>
              {phase === "post" && future[0] && (
                <button
                  className="es-next-event"
                  onClick={() => onOpenEvent(future[0]._id)}
                >
                  <strong>{future[0].name}</strong>
                  <span>
                    Coming next ·{" "}
                    {formatDateRangeSimple(
                      future[0].startDate,
                      future[0].endDate,
                    )}{" "}
                    <Arrow />
                  </span>
                </button>
              )}
            </div>
            <div className="es-participation">
              <div className="es-section-heading">
                <h2>{title}</h2>
                {typeof focal.event.teamCount === "number" && (
                  <span>{focal.event.teamCount} projects</span>
                )}
              </div>
              {projects === undefined ? (
                <p className="es-content-state" role="status">
                  Loading projects…
                </p>
              ) : emptyProjects ? (
                <div className="es-content-state">
                  <h3>The lineup is on its way.</h3>
                  <p>Projects will appear here as teams submit them.</p>
                </div>
              ) : mode === "demo_day" ? (
                <ul className="es-gallery">
                  {visibleProjects.map((project, i) => (
                    <li key={project._id}>
                      <button
                        onClick={() => onOpenProject(project)}
                        aria-label={`View ${project.name}`}
                      >
                        <ProjectArt index={i} />
                        <span className="es-gallery-caption">
                          <span>
                            <strong>{project.name}</strong>
                            <span>
                              {project.track || "Explore the project"}
                            </span>
                          </span>
                          <Arrow diagonal />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="es-working-layout">
                  <ProjectList
                    projects={visibleProjects}
                    onOpen={onOpenProject}
                  />
                  {mode === "hackathon" ? (
                    <aside className="es-guide">
                      <h3>
                        {phase === "post" ? "Event recap" : "A closer look"}
                      </h3>
                      <p>
                        {phase === "post"
                          ? "Explore the teams and the work they shared."
                          : "Get to know each project before you score."}
                      </p>
                      {categories.length > 0 && (
                        <>
                          <h4>Judging categories</h4>
                          <ul>
                            {categories.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <button onClick={() => onOpenEvent(focal.event._id)}>
                        View event details <Arrow />
                      </button>
                    </aside>
                  ) : (
                    <aside className="es-ballot-guide">
                      <h3>
                        {phase === "post"
                          ? "Voting has closed"
                          : "Make your picks"}
                      </h3>
                      {phase !== "post" ? (
                        <ol>
                          <li>
                            <span>1</span>Explore the projects.
                          </li>
                          <li>
                            <span>2</span>Rank up to five favorites.
                          </li>
                          <li>
                            <span>3</span>Review and submit your ballot.
                          </li>
                        </ol>
                      ) : (
                        <p className="es-recap-message">
                          Thanks for taking part. Revisit the projects and the
                          ideas they shared.
                        </p>
                      )}
                      <p>
                        {phase === "live"
                          ? "Your ballot is saved when you submit it."
                          : phase === "pre"
                            ? "Voting opens with the event."
                            : focal.event.resultsReleased
                              ? "The organizers have released the results."
                              : "Results appear when the organizers release them."}
                      </p>
                      <button onClick={onParticipate}>
                        {stageAction(focal.event, phase)}
                        <Arrow />
                      </button>
                    </aside>
                  )}
                </div>
              )}
              {!emptyProjects && (
                <button
                  className="es-all-projects"
                  onClick={() => onOpenEvent(focal.event._id)}
                >
                  Explore all projects <Arrow />
                </button>
              )}
            </div>
          </div>
        </section>
      )}
      <section
        className="es-calendar"
        id="event-calendar"
        aria-labelledby="calendar-title"
      >
        <div className="es-calendar-intro">
          <h2 id="calendar-title">On the calendar</h2>
          <p>More chances to build, share, and discover.</p>
          <span>
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(now)}
          </span>
        </div>
        <div className="es-calendar-events">
          {future.length ? (
            <ul>
              {future.map((event) => (
                <CalendarEvent
                  key={event._id}
                  event={event}
                  onOpen={onOpenEvent}
                />
              ))}
            </ul>
          ) : (
            <p className="es-calendar-empty">
              The next events will appear here when they’re scheduled.
            </p>
          )}
          {past.length > 0 && (
            <details>
              <summary>
                Past events <span>{past.length}</span>
              </summary>
              <ul>
                {past.map((event) => (
                  <CalendarEvent
                    key={event._id}
                    event={event}
                    onOpen={onOpenEvent}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>
      <footer className="es-footer">
        <span>HackJudge</span>
        <p>Hackathons, Demo Days, Code &amp; Tell.</p>
        {focal && (
          <a href="#featured-title">
            Back to the event <Arrow />
          </a>
        )}
      </footer>
    </div>
  );
}

function CalendarEvent({
  event,
  onOpen,
}: {
  event: StageEvent;
  onOpen: Props["onOpenEvent"];
}) {
  const date = new Date(event.startDate);
  return (
    <li>
      <button className="es-calendar-row" onClick={() => onOpen(event._id)}>
        <time dateTime={date.toISOString()}>
          <span>
            {new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)}
          </span>
          <strong>{date.getDate()}</strong>
        </time>
        <span className="es-calendar-copy">
          <strong>{event.name}</strong>
          <span>
            {getEventDisplayLabel(event.mode)} ·{" "}
            {formatDateRangeSimple(event.startDate, event.endDate)}
          </span>
        </span>
        <Arrow diagonal />
      </button>
    </li>
  );
}
