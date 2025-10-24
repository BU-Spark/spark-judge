import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";

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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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
                  className="card flex items-center justify-between p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{event.name}</h3>
                      {isComplete && (
                        <span className="text-emerald-500 text-sm font-medium">✓ Complete</span>
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
          <h2 className="text-xl font-heading font-semibold mb-4">Upcoming</h2>
          <div className="space-y-2">
            {upcomingEvents.map(({ event }) => (
              <div
                key={event._id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div>
                  <h3 className="font-medium text-foreground">{event.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(event.startDate)} - {formatDate(event.endDate)}
                  </p>
                </div>
                <button
                  onClick={() => onSelectEvent(event._id)}
                  className="btn-ghost text-sm"
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
            className="flex items-center gap-2 mb-4 text-lg font-heading font-semibold hover:text-primary transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expandedPastEvents ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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
                    className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-500">✓</span>
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
                      className="btn-ghost text-sm"
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
        <div className="card text-center py-12">
          <p className="text-muted-foreground mb-4">
            You haven't joined any events yet.
          </p>
          <button onClick={onBackToLanding} className="btn-primary">
            Browse Events
          </button>
        </div>
      )}
    </div>
  );
}
