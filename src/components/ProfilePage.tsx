import { CODE_AND_TELL_TITLE } from "../lib/codeAndTellPresentation";
import { formatDateTime } from "../lib/utils";
import { profileParticipation } from "../lib/profileParticipation";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
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
  const { user } = profile;
  const { activeEvents, historyEvents, totalTeamsScored } = profileParticipation(profile);
  const participantEvents = profile.participantEvents ?? [];
  const attendedEventCount = new Set([
    ...activeEvents.map(entry => entry.event._id),
    ...historyEvents.map(entry => entry.event._id),
    ...participantEvents.map(entry => entry.event._id),
  ]).size;
  return (
    <div className="pp-page">
      <header className="pp-header">
        <div>
          <h1>{user.name || "My profile"}</h1>
          {user.email && <p className="pp-email">{user.email}</p>}
        </div>
        <div className="pp-header-stats" aria-label="Judging activity">
          <span>
            {attendedEventCount} {attendedEventCount === 1 ? "event" : "events"}
          </span>
          <span>
            {totalTeamsScored}{" "}
            {totalTeamsScored === 1 ? "team" : "teams"} scored
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
      {participantEvents.length > 0 && (
        <section className="pp-zone" aria-labelledby="pp-participant-h">
          <div className="pp-zone-head">
            <h2 id="pp-participant-h">Participated in</h2>
          </div>
          <ul className="pp-event-list">
            {participantEvents.map(({ event, projectNames }) => (
              <li key={event._id} className="pp-event-row">
                <div>
                  <h3>{event.mode === "code_and_tell" ? CODE_AND_TELL_TITLE : event.name}</h3>
                  <p>{getEventDisplayLabel(event.mode)} · Participant</p>
                  <p>{formatDateTime(event.startDate)}</p>
                  {projectNames.length > 0 && <p>{projectNames.join(" · ")}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {historyEvents.length > 0 && (
        <section className="pp-zone" aria-labelledby="pp-past-h">
          <div className="pp-zone-head">
            <h2 id="pp-past-h">
              <button
                className="pp-zone-toggle"
                onClick={() => setExpandedPastEvents(!expandedPastEvents)}
                aria-expanded={expandedPastEvents}
                aria-controls="pp-completed-events"
              >
                Scoring history{" "}
                <DirectionIcon direction={expandedPastEvents ? "up" : "down"} />
              </button>
            </h2>
            <span>
              {historyEvents.length} {historyEvents.length === 1 ? "event" : "events"}
            </span>
          </div>
          <ul
            className="pp-event-list"
            id="pp-completed-events"
            hidden={!expandedPastEvents}
          >
            {historyEvents.map(({ event, teamsJudged, scoresSubmitted }) => {
              const skippedCount = teamsJudged - scoresSubmitted;
              return (
                <li key={event._id} className="pp-event-row">
                  <div>
                    <h3>{event.name}</h3>
                    <p>{getEventDisplayLabel(event.mode)}</p>
                    <p>
                      {scoresSubmitted}/{teamsJudged} teams
                      {skippedCount > 0 && ` · ${skippedCount} skipped`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {attendedEventCount === 0 && (
          <section className="pp-idle" aria-labelledby="pp-empty-heading">
            <h2 id="pp-empty-heading">No events attended yet.</h2>
            <p>Browse events to see what’s happening at HackJudge.</p>
            <button className="pp-primary" onClick={onBackToLanding}>
              Browse events <DirectionIcon />
            </button>
          </section>
        )}
    </div>
  );
}
