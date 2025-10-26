import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { SignInForm } from "../SignInFormNew";
import { useState } from "react";
import { JudgeCodeModal } from "./JudgeCodeModalNew";
import { TeamSubmissionModal } from "./TeamSubmissionModalNew";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";

export function LandingPage({ onSelectEvent }: { onSelectEvent: (eventId: Id<"events">) => void }) {
  const events = useQuery(api.events.listEvents);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const joinAsJudge = useMutation(api.events.joinAsJudge);
  
  const [showSignIn, setShowSignIn] = useState(false);
  const [joiningEvents, setJoiningEvents] = useState<Set<Id<"events">>>(new Set());
  const [judgeCodeModal, setJudgeCodeModal] = useState<{
    isOpen: boolean;
    eventId: Id<"events"> | null;
  }>({ isOpen: false, eventId: null });
  const [teamSubmissionModal, setTeamSubmissionModal] = useState<{
    isOpen: boolean;
    eventId: Id<"events"> | null;
    tracks: string[];
    existingTeam: any;
  }>({ isOpen: false, eventId: null, tracks: [], existingTeam: null });

  const handleJoinAsJudge = async (eventId: Id<"events">) => {
    if (!loggedInUser) {
      setShowSignIn(true);
      return;
    }

    if (joiningEvents.has(eventId)) return;

    setJoiningEvents(prev => new Set(prev).add(eventId));

    try {
      await joinAsJudge({ eventId });
      toast.success("Successfully joined as judge!");
    } catch (error: any) {
      toast.error(error.message || "Failed to join as judge");
    } finally {
      setJoiningEvents(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const handleStartScoring = (event: any) => {
    if (!loggedInUser) {
      setShowSignIn(true);
      return;
    }

    // If event requires judge code, show modal
    if (event.requiresJudgeCode) {
      setJudgeCodeModal({ isOpen: true, eventId: event._id });
    } else {
      // No code required, go directly to event
      onSelectEvent(event._id);
    }
  };

  const handleJudgeCodeSuccess = () => {
    if (judgeCodeModal.eventId) {
      onSelectEvent(judgeCodeModal.eventId);
    }
  };

  const handleAddTeam = (event: { _id: any; tracks: any; categories: any; }) => {
    if (!loggedInUser) {
      setShowSignIn(true);
      return;
    }

    setTeamSubmissionModal({
      isOpen: true,
      eventId: event._id,
      tracks: event.tracks || event.categories, // Use tracks if defined, otherwise categories
      existingTeam: null, // Modal will fetch team itself
    });
  };

  if (events === undefined) {
    return <LoadingState label="Loading events..." />;
  }

  if (!events) {
    return (
      <ErrorState
        title="Unable to load events"
        description="We couldn't fetch the list of events right now. Please refresh the page to try again."
        actionLabel="Refresh"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16 space-y-4 hidden">
          <h1 className="text-5xl font-heading font-bold text-foreground text-reveal">
            Hackathon Judging Platform
          </h1>
          <p className="text-xl text-muted-foreground text-reveal text-reveal-delay">
            Streamlined judging for hackathon events
          </p>
        </div>

        <EventSection
          title="Active Events"
          events={events.active}
          onJoinAsJudge={handleJoinAsJudge}
          onStartScoring={handleStartScoring}
          onAddTeam={handleAddTeam}
          joiningEvents={joiningEvents}
          emptyMessage="No active events at the moment"
          animationDelay={0.2}
          isActiveSection={true}
          isPastSection={false}
        />

        <EventSection
          title="Upcoming Events"
          events={events.upcoming}
          onJoinAsJudge={handleJoinAsJudge}
          onStartScoring={handleStartScoring}
          onAddTeam={handleAddTeam}
          joiningEvents={joiningEvents}
          emptyMessage="No upcoming events scheduled"
          animationDelay={0.3}
          isActiveSection={false}
          isPastSection={false}
        />

        <EventSection
          title="Past Events"
          events={events.past}
          onJoinAsJudge={handleJoinAsJudge}
          onStartScoring={handleStartScoring}
          onAddTeam={handleAddTeam}
          joiningEvents={joiningEvents}
          emptyMessage="No past events"
          animationDelay={0.4}
          isActiveSection={false}
          isPastSection={true}
        />
      </div>

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSignIn(false)}
          />
          <div className="relative bg-background rounded-2xl p-8 max-w-md w-full shadow-2xl slide-up border border-border">
            <button
              onClick={() => setShowSignIn(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-heading font-bold mb-6 text-foreground">Sign In</h2>
            <SignInForm />
          </div>
        </div>
      )}

      {/* Judge Code Modal */}
      {judgeCodeModal.eventId && (
        <JudgeCodeModal
          isOpen={judgeCodeModal.isOpen}
          onClose={() => setJudgeCodeModal({ isOpen: false, eventId: null })}
          eventId={judgeCodeModal.eventId}
          onSuccess={handleJudgeCodeSuccess}
        />
      )}

      {/* Team Submission Modal */}
      {teamSubmissionModal.eventId && (
        <TeamSubmissionModal
          isOpen={teamSubmissionModal.isOpen}
          onClose={() => setTeamSubmissionModal({ isOpen: false, eventId: null, tracks: [], existingTeam: null })}
          eventId={teamSubmissionModal.eventId}
          tracks={teamSubmissionModal.tracks}
          existingTeam={teamSubmissionModal.existingTeam}
        />
      )}
    </>
  );
}

function EventSection({
  title,
  events,
  onJoinAsJudge,
  onStartScoring,
  onAddTeam,
  joiningEvents,
  emptyMessage,
  animationDelay,
  isActiveSection,
  isPastSection,
}: {
  title: string;
  events: Array<any>;
  onJoinAsJudge: (eventId: Id<"events">) => void;
  onStartScoring: (event: any) => void;
  onAddTeam: (event: any) => void;
  joiningEvents: Set<Id<"events">>;
  emptyMessage: string;
  animationDelay: number;
  isActiveSection: boolean;
  isPastSection?: boolean;
}) {
  return (
    <section 
      className="mb-16 slide-up"
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <h2 className="text-2xl font-heading font-bold mb-6 text-foreground">{title}</h2>
      {events.length === 0 ? (
        <div className="text-muted-foreground text-center py-12 bg-card rounded-xl border border-border">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event, index) => (
            <EventCard
              key={event._id}
              event={event}
              onJoinAsJudge={onJoinAsJudge}
              onStartScoring={onStartScoring}
              onAddTeam={onAddTeam}
              isJoining={joiningEvents.has(event._id)}
              isActiveSection={isActiveSection}
              isPastSection={Boolean(isPastSection)}
              animationDelay={animationDelay + index * 0.1}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({
  event,
  onJoinAsJudge,
  onStartScoring,
  onAddTeam,
  isJoining,
  isActiveSection,
  isPastSection,
  animationDelay,
}: {
  event: any;
  onJoinAsJudge: (eventId: Id<"events">) => void;
  onStartScoring: (event: any) => void;
  onAddTeam: (event: any) => void;
  isJoining: boolean;
  isActiveSection: boolean;
  isPastSection: boolean;
  animationDelay: number;
}) {
  const userRole = event.userRole?.role;
  const isJudge = userRole === "judge";
  const isParticipant = userRole === "participant";
  const judgeProgress = event.judgeProgress as { completedTeams: number; totalTeams: number } | undefined;
  const hasCompletedScoring = Boolean(
    judgeProgress && judgeProgress.totalTeams > 0 && judgeProgress.completedTeams >= judgeProgress.totalTeams
  );
  
  return (
    <div
      className="group card-glass"
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {isActiveSection && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          )}
          <h3 className="text-lg font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
            {event.name}
          </h3>
        </div>
        {userRole && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            isJudge ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : 
            "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
          }`}>
            {isJudge ? "Judge" : "Participant"}
          </span>
        )}
      </div>
      
      <p className="text-muted-foreground mb-4 line-clamp-2">
        {event.description}
      </p>
      
      <div className="flex justify-between text-sm text-muted-foreground mb-4">
        <span>{new Date(event.startDate).toLocaleDateString()}</span>
        <span className="badge">{event.teamCount} teams</span>
      </div>

      <div className="space-y-2">
        {/* Judge Buttons */}
        {!isParticipant && !isPastSection && (
          <>
            {!isJudge ? (
              <button
                onClick={() => onJoinAsJudge(event._id)}
                disabled={isJoining}
                className="btn-secondary w-full"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  "Join as Judge"
                )}
              </button>
            ) : isActiveSection ? (
              <button
                onClick={() => onStartScoring(event)}
                className={`w-full btn-primary transition-all ${hasCompletedScoring ? 'opacity-60 cursor-not-allowed hover:none' : ''}`}
                disabled={hasCompletedScoring}
              >
                <span className="flex items-center justify-center gap-2">
                  {hasCompletedScoring ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Scoring Complete
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {judgeProgress && judgeProgress.completedTeams > 0
                        ? `Resume Scoring (${judgeProgress.completedTeams}/${judgeProgress.totalTeams})`
                        : "Start Scoring"}
                    </>
                  )}
                </span>
              </button>
            ) : (
              <div className="w-full bg-green-600 text-white font-medium py-3 px-6 rounded-xl text-center flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Joined
              </div>
            )}
          </>
        )}

        {/* Participant Buttons - Only for Active Events */}
        {isActiveSection && !isJudge && (
          <button
            onClick={() => onAddTeam(event)}
            className={`w-full py-3 px-6 rounded-xl font-medium transition-all ${
              isParticipant
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-foreground hover:bg-muted/80 border border-border"
            }`}
          >
            {isParticipant ? "View/Edit Team" : "Add Your Team"}
          </button>
        )}
      </div>
    </div>
  );
}
