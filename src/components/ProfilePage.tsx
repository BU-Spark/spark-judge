import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { formatDateTime } from "../lib/utils";

interface ProfilePageProps {
  onSelectEvent: (eventId: Id<"events">) => void;
  onBackToLanding: () => void;
}

export function ProfilePage({ onSelectEvent, onBackToLanding }: ProfilePageProps) {
  const profile = useQuery(api.users.getUserProfile);
  const [expandedPastEvents, setExpandedPastEvents] = useState(false);

  if (profile === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="card text-center">
          <h2 className="text-2xl font-heading font-bold mb-4">Not Signed In</h2>
          <p className="text-muted-foreground mb-6">Please sign in to view your profile.</p>
          <button onClick={onBackToLanding} className="btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const { user, pastEvents, activeEvents, upcomingEvents, stats } = profile;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Simple header with name and quick stats */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">
          {user.name || "Anonymous Judge"}
        </h1>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{stats.totalEvents} events</span>
          <span>{stats.totalTeamsScored} teams scored</span>
        </div>
      </div>

      {/* Active judging - most important */}
      {activeEvents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-heading font-semibold mb-4">Active Judging</h2>
          <div className="space-y-3">
            {activeEvents.map(({ event, teamsJudged, scoresSubmitted }) => {
              const progressPercent = teamsJudged > 0
                ? Math.round((scoresSubmitted / teamsJudged) * 100)
                : 0;
              const isComplete = scoresSubmitted >= teamsJudged * 0.8; // 80% threshold

              return (
                <div
                  key={event._id}
                  className="glass flex items-center justify-between p-4 glow-hover border-border/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{event.name}</h3>
                      {isComplete && (
                        <span className="text-emerald-500 text-sm font-medium flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          Complete
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Progress: {scoresSubmitted}/{teamsJudged} teams ({progressPercent}%)
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectEvent(event._id)}
                    className="btn-primary"
                  >
                    {scoresSubmitted > 0 ? "Continue" : "Start Scoring"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Upcoming - minimal */}
      {upcomingEvents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-heading font-semibold mb-4 text-gradient">Upcoming</h2>
          <div className="space-y-3">
            {upcomingEvents.map(({ event }) => (
              <div
                key={event._id}
                className="flex items-center justify-between p-4 bg-muted/20 backdrop-blur-sm border border-border/30 rounded-2xl glow-hover transition-all duration-300"
              >
                <div>
                  <h3 className="font-semibold text-foreground">{event.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDateTime(event.startDate)} - {formatDateTime(event.endDate)}
                  </p>
                </div>
                <button
                  onClick={() => onSelectEvent(event._id)}
                  className="btn-ghost text-sm hover:bg-primary/10 hover:text-primary rounded-xl"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past - collapsed by default */}
      {pastEvents.length > 0 && (
        <section>
          <button
            onClick={() => setExpandedPastEvents(!expandedPastEvents)}
            className="flex items-center gap-2 mb-4 text-lg font-heading font-semibold hover:text-primary transition-colors group"
          >
            <div className="p-1 px-2 rounded-lg bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <svg
                className={`w-4 h-4 transition-transform ${expandedPastEvents ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            Completed ({pastEvents.length} events)
          </button>

          {expandedPastEvents && (
            <div className="space-y-2">
              {pastEvents.map(({ event, teamsJudged, scoresSubmitted }) => {
                const isComplete = scoresSubmitted >= teamsJudged * 0.8;
                const skippedCount = teamsJudged - scoresSubmitted;

                return (
                  <div
                    key={event._id}
                    className="flex items-center justify-between p-4 bg-muted/10 backdrop-blur-sm border border-border/20 rounded-2xl hover:bg-muted/20 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{event.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {scoresSubmitted}/{teamsJudged} teams
                          {skippedCount > 0 && ` (${skippedCount} skipped)`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectEvent(event._id)}
                      className="btn-ghost text-sm hover:bg-primary/10 rounded-xl"
                    >
                      View Results
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* No events message */}
      {activeEvents.length === 0 && upcomingEvents.length === 0 && pastEvents.length === 0 && (
        <div className="glass text-center py-16 border-border/50">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xl font-heading font-semibold mb-2">No events yet</p>
          <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
            You haven't joined any events yet. Check out the featured events to get started!
          </p>
          <button onClick={onBackToLanding} className="btn-primary shadow-xl shadow-primary/20">
            Browse Featured Events
          </button>
        </div>
      )}
    </div>
  );
}
