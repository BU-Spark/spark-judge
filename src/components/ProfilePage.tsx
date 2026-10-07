import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { formatDateTime } from "../lib/utils";
import { getEventDisplayLabel } from "../lib/eventModes";
import { DirectionIcon } from "./participation/ParticipationChrome";
import "./ProfilePage.fi.css";

interface ProfilePageProps {
  onSelectEvent: (eventId: Id<"events">) => void;
  onBackToLanding: () => void;
}
export type ProfileData = FunctionReturnType<typeof api.users.getUserProfile>;

export function ProfilePage(props: ProfilePageProps) {
  const profile = useQuery(api.users.getUserProfile);
  return <ProfilePageView {...props} profile={profile} />;
}

export function ProfilePageView({
  profile,
  onSelectEvent,
  onBackToLanding,
}: ProfilePageProps & { profile: ProfileData | undefined }) {
  const [expandedPastEvents, setExpandedPastEvents] = useState(false);
  if (profile === undefined) {
    return (
      <div className="pp-page pp-loading" role="status">
        Loading your profile…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="pp-page">
        <header className="pp-header">
          <h1>My profile</h1>
        </header>
        <section className="pp-idle" aria-labelledby="pp-signin-heading">
          <h2 id="pp-signin-heading">Your events, all in one place.</h2>
          <p>
            Sign in to see your judging assignments and return to your events.
          </p>
          <button
            className="pp-primary"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("hackjudge:open-signin"))
            }
          >
            Sign in <DirectionIcon />
          </button>
        </section>
      </div>
    );
  }
  const { user, pastEvents, activeEvents, upcomingEvents, stats } = profile;
  return (
    <div className="pp-page">
      <header className="pp-header">
        <div>
          <h1>{user.name || "My profile"}</h1>
          {user.email && <p className="pp-email">{user.email}</p>}
        </div>
        <div className="pp-header-stats" aria-label="Judging activity">
          <span>
            {stats.totalEvents} {stats.totalEvents === 1 ? "event" : "events"}
          </span>
          <span>
            {stats.totalTeamsScored}{" "}
            {stats.totalTeamsScored === 1 ? "team" : "teams"} scored
          </span>
        </div>
      </header>
      {activeEvents.length > 0 && (
        <section className="pp-zone" aria-labelledby="pp-active-h">
          <div className="pp-zone-head">
            <h2 id="pp-active-h">Active judging</h2>
            <span>{activeEvents.length} live</span>
          </div>
          <div className="pp-active-list">
            {activeEvents.map(({ event, teamsJudged, scoresSubmitted }) => {
              const progressPercent =
                teamsJudged > 0
                  ? Math.round((scoresSubmitted / teamsJudged) * 100)
                  : 0;
              const isComplete =
                teamsJudged > 0 && scoresSubmitted >= teamsJudged * 0.8;
              return (
                <article key={event._id} className="pp-active-event">
                  <div className="pp-active-status">
                    <span className="pp-mode">
                      {getEventDisplayLabel(event.mode)}
                    </span>
                    {isComplete && <span className="pp-status">Complete</span>}
                  </div>
                  <h3>{event.name}</h3>
                  <p className="pp-progress">
                    {scoresSubmitted} of {teamsJudged} teams scored
                    {teamsJudged > 0 ? ` · ${progressPercent}%` : ""}
                  </p>
                  <button
                    className="pp-primary"
                    onClick={() => onSelectEvent(event._id)}
                  >
                    {scoresSubmitted > 0 ? "Resume scoring" : "Start scoring"}{" "}
                    <DirectionIcon />
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
            <h2 id="pp-upcoming-h">Upcoming</h2>
            <span>
              {upcomingEvents.length}{" "}
              {upcomingEvents.length === 1 ? "event" : "events"}
            </span>
          </div>
          <ul className="pp-event-list">
            {upcomingEvents.map(({ event }) => (
              <li key={event._id} className="pp-event-row">
                <div>
                  <h3>{event.name}</h3>
                  <p>{getEventDisplayLabel(event.mode)}</p>
                  <p className="pp-dates">
                    {formatDateTime(event.startDate)} –{" "}
                    {formatDateTime(event.endDate)}
                  </p>
                </div>
                <button
                  className="pp-secondary"
                  onClick={() => onSelectEvent(event._id)}
                >
                  View details <DirectionIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pastEvents.length > 0 && (
        <section className="pp-zone" aria-labelledby="pp-past-h">
          <div className="pp-zone-head">
            <h2 id="pp-past-h">
              <button
                className="pp-zone-toggle"
                onClick={() => setExpandedPastEvents(!expandedPastEvents)}
                aria-expanded={expandedPastEvents}
                aria-controls="pp-completed-events"
              >
                Completed{" "}
                <DirectionIcon direction={expandedPastEvents ? "up" : "down"} />
              </button>
            </h2>
            <span>
              {pastEvents.length} {pastEvents.length === 1 ? "event" : "events"}
            </span>
          </div>
          <ul
            className="pp-event-list"
            id="pp-completed-events"
            hidden={!expandedPastEvents}
          >
            {pastEvents.map(({ event, teamsJudged, scoresSubmitted }) => {
              const skippedCount = teamsJudged - scoresSubmitted;
              return (
                <li key={event._id} className="pp-event-row">
                  <div>
                    <h3>{event.name}</h3>
                    <p>{getEventDisplayLabel(event.mode)} · Closed</p>
                    <p>
                      {scoresSubmitted}/{teamsJudged} teams
                      {skippedCount > 0 && ` · ${skippedCount} skipped`}
                    </p>
                  </div>
                  <button
                    className="pp-secondary"
                    onClick={() => onSelectEvent(event._id)}
                  >
                    View results <DirectionIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {activeEvents.length === 0 &&
        upcomingEvents.length === 0 &&
        pastEvents.length === 0 && (
          <section className="pp-idle" aria-labelledby="pp-empty-heading">
            <h2 id="pp-empty-heading">No judging assignments yet.</h2>
            <p>Browse events to see what’s happening at HackJudge.</p>
            <button className="pp-primary" onClick={onBackToLanding}>
              Browse events <DirectionIcon />
            </button>
          </section>
        )}
    </div>
  );
}
