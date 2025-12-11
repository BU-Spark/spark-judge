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
import { formatDateTime, formatDateRange } from "../lib/utils";

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
    courseCodes: string[];
    eventMode: "hackathon" | "demo_day";
    existingTeam: any;
  }>({ isOpen: false, eventId: null, tracks: [], courseCodes: [], eventMode: "hackathon", existingTeam: null });

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

  const handleJoinAsJudgeSafe = (eventId: Id<"events">) => {
    void handleJoinAsJudge(eventId);
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

  // Demo Day events can be browsed without signing in
  const handleBrowseDemoDay = (eventId: Id<"events">) => {
    onSelectEvent(eventId);
  };

  const handleJudgeCodeSuccess = () => {
    if (judgeCodeModal.eventId) {
      onSelectEvent(judgeCodeModal.eventId);
    }
  };

  const handleAddTeam = (event: { _id: any; tracks: any; categories: any; courseCodes?: string[]; mode?: "hackathon" | "demo_day"; }) => {
    if (!loggedInUser) {
      setShowSignIn(true);
      return;
    }

    setTeamSubmissionModal({
      isOpen: true,
      eventId: event._id,
      tracks: event.tracks || event.categories, // Use tracks if defined, otherwise categories
      courseCodes: event.courseCodes || [],
      eventMode: event.mode || "hackathon",
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
        <ActiveEventSection
          title="Active Events"
          events={events.active}
          onJoinAsJudge={handleJoinAsJudgeSafe}
          onStartScoring={handleStartScoring}
          onBrowseDemoDay={handleBrowseDemoDay}
          onAddTeam={handleAddTeam}
          joiningEvents={joiningEvents}
          emptyMessage="No active events at the moment"
        />

        <CompactEventSection
          title="Upcoming Events"
          events={events.upcoming}
          onJoinAsJudge={handleJoinAsJudgeSafe}
          onStartScoring={handleStartScoring}
          onBrowseDemoDay={handleBrowseDemoDay}
          onAddTeam={handleAddTeam}
          joiningEvents={joiningEvents}
          emptyMessage="No upcoming events scheduled"
          isPastSection={false}
        />

        <CompactEventSection
          title="Past Events"
          events={events.past}
          onJoinAsJudge={handleJoinAsJudgeSafe}
          onStartScoring={handleStartScoring}
          onBrowseDemoDay={handleBrowseDemoDay}
          onAddTeam={handleAddTeam}
          joiningEvents={joiningEvents}
          emptyMessage="No past events"
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
          <div className="relative bg-background rounded-lg p-8 max-w-md w-full shadow-pop border border-border">
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
          onClose={() => setTeamSubmissionModal({ isOpen: false, eventId: null, tracks: [], courseCodes: [], eventMode: "hackathon", existingTeam: null })}
          eventId={teamSubmissionModal.eventId}
          tracks={teamSubmissionModal.tracks}
          courseCodes={teamSubmissionModal.courseCodes}
          eventMode={teamSubmissionModal.eventMode}
          existingTeam={teamSubmissionModal.existingTeam}
        />
      )}
    </>
  );
}

function ActiveEventSection({
  title,
  events,
  onJoinAsJudge,
  onStartScoring,
  onBrowseDemoDay,
  onAddTeam,
  joiningEvents,
  emptyMessage,
}: {
  title: string;
  events: Array<any>;
  onJoinAsJudge: (eventId: Id<"events">) => void;
  onStartScoring: (event: any) => void;
  onBrowseDemoDay: (eventId: Id<"events">) => void;
  onAddTeam: (event: any) => void;
  joiningEvents: Set<Id<"events">>;
  emptyMessage: string;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-heading font-bold mb-6 text-foreground flex items-center gap-3">
        {title}
        {events.length > 0 && <span className="text-xs font-medium text-primary-foreground bg-primary px-2 py-0.5 rounded-full">{events.length}</span>}
      </h2>
      {events.length === 0 ? (
        <div className="text-muted-foreground text-center py-12 bg-card rounded-lg border border-border shadow-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 px-5 snap-x snap-mandatory flex-nowrap md:px-0">
          {events.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              onJoinAsJudge={onJoinAsJudge}
              onStartScoring={onStartScoring}
              onBrowseDemoDay={onBrowseDemoDay}
              onAddTeam={onAddTeam}
              isJoining={joiningEvents.has(event._id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CompactEventSection({
  title,
  events,
  onJoinAsJudge,
  onStartScoring,
  onBrowseDemoDay,
  onAddTeam,
  joiningEvents,
  emptyMessage,
  isPastSection,
}: {
  title: string;
  events: Array<any>;
  onJoinAsJudge: (eventId: Id<"events">) => void;
  onStartScoring: (event: any) => void;
  onBrowseDemoDay: (eventId: Id<"events">) => void;
  onAddTeam: (event: any) => void;
  joiningEvents: Set<Id<"events">>;
  emptyMessage: string;
  isPastSection?: boolean;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-lg font-heading font-semibold mb-6 text-foreground flex items-center gap-3">
        {title}
        {events.length > 0 && <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{events.length}</span>}
      </h2>
      {events.length === 0 ? (
        <div className="text-muted-foreground text-sm py-6 border-b border-border">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <EventRow
              key={event._id}
              event={event}
              onJoinAsJudge={onJoinAsJudge}
              onStartScoring={onStartScoring}
              onBrowseDemoDay={onBrowseDemoDay}
              onAddTeam={onAddTeam}
              isJoining={joiningEvents.has(event._id)}
              isPastSection={isPastSection}
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
  onBrowseDemoDay,
  onAddTeam,
  isJoining,
}: {
  event: any;
  onJoinAsJudge: (eventId: Id<"events">) => void;
  onStartScoring: (event: any) => void;
  onBrowseDemoDay: (eventId: Id<"events">) => void;
  onAddTeam: (event: any) => void;
  isJoining: boolean;
}) {
  const userRole = event.userRole?.role;
  const isJudge = userRole === "judge";
  const isParticipant = userRole === "participant";
  const isDemoDay = event.mode === "demo_day";
  const judgeProgress = event.judgeProgress as { completedTeams: number; totalTeams: number } | undefined;
  const hasCompletedScoring = Boolean(
    judgeProgress && judgeProgress.totalTeams > 0 && judgeProgress.completedTeams >= judgeProgress.totalTeams
  );
  const showSideBySide = !isDemoDay && !userRole;
  const addTeamTemporarilyDisabled = !isDemoDay; // Hackathon add-team temporarily disabled
  
  return (
    <div className="card-static flex flex-col overflow-hidden w-[320px] sm:w-[360px] flex-shrink-0 snap-start h-[360px]">
      <div className="p-5 pb-4 flex flex-col h-full">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Live</span>
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground leading-snug line-clamp-2 break-words">
              {event.name}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isDemoDay && (
              <span className="badge bg-pink-500/10 text-pink-400 border border-pink-500/20 font-medium">
                Demo Day
              </span>
            )}
            {userRole && (
              <span className={`badge flex-shrink-0 ${
                isJudge ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20" : 
                "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              }`}>
                {isJudge ? "Judge" : "Participant"}
              </span>
            )}
          </div>
        </div>

        <p className="text-base text-muted-foreground line-clamp-3 mb-6 flex-grow leading-relaxed">
          {event.description}
        </p>
        
        <div className="flex justify-between text-xs text-muted-foreground mb-6 items-center border-t border-border pt-4">
          <span className="flex items-center gap-1.5 font-medium">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDateRange(event.startDate, event.endDate)}</span>
          </span>
          <span className="bg-muted/50 px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground">
            {event.teamCount} {isDemoDay ? "projects" : "teams"}
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-2 justify-end pb-0">
          {isDemoDay && (
            <button
              onClick={() => onBrowseDemoDay(event._id)}
              className="w-full h-12 px-4 rounded-md text-sm font-medium flex items-center justify-center shadow-md transition-all bg-primary text-primary-foreground hover:bg-teal-700 dark:hover:bg-teal-500 hover:shadow-lg"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Browse & Appreciate
              </span>
            </button>
          )}

          {showSideBySide ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  void onJoinAsJudge(event._id);
                }}
                disabled={isJoining}
                className="flex-1 h-12 px-3 rounded-md text-sm font-medium border border-border bg-card text-foreground shadow-sm transition-all hover:bg-muted hover:border-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
              <button
                onClick={() => onAddTeam(event)}
                disabled={addTeamTemporarilyDisabled}
                title={addTeamTemporarilyDisabled ? "Team submissions are temporarily disabled" : undefined}
                className={`flex-1 h-12 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  addTeamTemporarilyDisabled
                    ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                    : "bg-muted text-foreground border border-border hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:shadow-sm"
                }`}
              >
                Add Your Team
              </button>
            </div>
          ) : (
            <>
              {!isDemoDay && !isParticipant && (
                <>
                  {!isJudge ? (
                    <button
                      onClick={() => {
                        void onJoinAsJudge(event._id);
                      }}
                      disabled={isJoining}
                    className="w-full h-12 px-4 rounded-md text-sm font-medium border border-border bg-card text-foreground shadow-sm transition-all hover:bg-muted hover:border-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
                  ) : (
                    <button
                      onClick={() => onStartScoring(event)}
                      className={`w-full h-12 px-4 rounded-md text-sm font-medium btn-primary shadow-md hover:shadow-lg transition-all ${hasCompletedScoring ? 'opacity-90' : ''} flex items-center justify-center`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {hasCompletedScoring ? (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Scoring Complete
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {judgeProgress && judgeProgress.completedTeams > 0
                              ? `Resume (${judgeProgress.completedTeams}/${judgeProgress.totalTeams})`
                              : "Start Scoring"}
                          </>
                        )}
                      </span>
                    </button>
                  )}
                </>
              )}

              {!isDemoDay && !isJudge && (
                <button
                  onClick={() => onAddTeam(event)}
                  disabled={addTeamTemporarilyDisabled}
                  title={addTeamTemporarilyDisabled ? "Team submissions are temporarily disabled" : undefined}
                  className={`w-full h-12 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                    addTeamTemporarilyDisabled
                      ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                      : isParticipant
                        ? "bg-primary text-primary-foreground hover:bg-teal-700 dark:hover:bg-teal-500 shadow-sm hover:shadow-md"
                        : "bg-muted text-foreground border border-border hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:shadow-sm"
                  }`}
                >
                  {isParticipant ? "View/Edit Team" : "Add Your Team"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  onJoinAsJudge,
  onStartScoring,
  onBrowseDemoDay,
  onAddTeam,
  isJoining,
  isPastSection,
}: {
  event: any;
  onJoinAsJudge: (eventId: Id<"events">) => void;
  onStartScoring: (event: any) => void;
  onBrowseDemoDay: (eventId: Id<"events">) => void;
  onAddTeam: (event: any) => void;
  isJoining: boolean;
  isPastSection?: boolean;
}) {
  const userRole = event.userRole?.role;
  const isJudge = userRole === "judge";
  const isParticipant = userRole === "participant";
  const isDemoDay = event.mode === "demo_day";
  const [isExpanded, setIsExpanded] = useState(false);
  const addTeamDisabled = true; // Temporarily disable add-team on hackathon cards
  
  return (
    <div className="card-static bg-card transition-colors hover:bg-muted/50">
      {/* Mobile Layout */}
      <div className="md:hidden p-4">
        <div 
          className="flex justify-between items-start cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-muted-foreground">
                {formatDateTime(event.startDate).split(',')[0]}
              </span>
              {isDemoDay && (
                <span className="badge bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[10px] px-1.5 py-0.5 h-5">
                  Demo Day
                </span>
              )}
            </div>
            <h3 className="font-bold text-foreground truncate">
              {event.name}
            </h3>
            <div className="text-xs text-muted-foreground mt-1">
              {event.teamCount} {isDemoDay ? "projects" : "teams"}
            </div>
          </div>
          <button className="text-muted-foreground p-1">
            <svg 
              className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="flex flex-col gap-2">
              {isPastSection ? (
                <button
                  onClick={() => onStartScoring(event)}
                  className="w-full text-sm font-semibold text-primary px-4 py-2 rounded-md transition-all hover:bg-primary hover:text-primary-foreground border border-teal-500/20"
                >
                  View Results
                </button>
              ) : isDemoDay ? (
                <button
                  onClick={() => onBrowseDemoDay(event._id)}
                  className="w-full py-2 px-4 text-sm rounded-md font-medium bg-primary text-primary-foreground shadow-sm transition-all hover:bg-teal-700 dark:hover:bg-teal-500 hover:shadow-md"
                >
                  Browse
                </button>
              ) : (
                <>
                  {!isJudge && !isPastSection && (
                    <button
                      onClick={() => onAddTeam(event)}
                      disabled={addTeamDisabled}
                  title={addTeamDisabled ? "Team submissions are temporarily disabled" : undefined}
                      className={`w-full text-sm font-semibold px-4 py-2 rounded-md transition-all ${
                        addTeamDisabled
                          ? "opacity-60 cursor-not-allowed bg-muted text-muted-foreground"
                          : isParticipant 
                            ? "text-primary bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 hover:shadow-sm" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted hover:shadow-sm border border-border"
                      }`}
                    >
                      {isParticipant ? "View Team" : "Add Team"}
                    </button>
                  )}
                  
                  {!userRole ? (
                    <button
                      onClick={() => void onJoinAsJudge(event._id)}
                      disabled={isJoining}
                      className="w-full py-2 px-4 text-sm rounded-md font-medium border border-border bg-card text-foreground shadow-sm transition-all hover:bg-muted hover:border-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isJoining ? "Joining..." : "Join as Judge"}
                    </button>
                  ) : (
                    <div className={`w-full text-center text-sm font-bold px-4 py-2 rounded-md border ${
                      isJudge 
                        ? "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20" 
                        : "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
                    }`}>
                      Registered as {userRole === 'judge' ? 'Judge' : 'Participant'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex p-4 items-center gap-6">
        <div className="flex-shrink-0 w-32 text-sm">
          <div className="font-bold text-foreground">{formatDateTime(event.startDate).split(',')[0]}</div>
          <div className="text-muted-foreground text-xs font-medium">{formatDateTime(event.startDate).split(',')[1]}</div>
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-base font-bold text-foreground truncate">
              {event.name}
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
            <span>{event.teamCount} {isDemoDay ? "projects" : "teams"}</span>
            {isPastSection && event.overallWinner && (
              <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1 font-bold">
                🏆 Winner announced
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDemoDay && (
            <span className="badge bg-pink-500/10 text-pink-400 border border-pink-500/20 flex-shrink-0">
              Demo Day
            </span>
          )}
          {userRole && (
            <span className={`badge flex-shrink-0 ${
              isJudge ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20" : 
              "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
            }`}>
              {isJudge ? "Judge" : "Participant"}
            </span>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-3">
          {isPastSection ? (
            <button
              onClick={() => onStartScoring(event)}
              className="text-sm font-semibold text-primary px-4 py-2 rounded-md transition-all hover:bg-primary hover:text-primary-foreground"
            >
              View Results
            </button>
          ) : isDemoDay ? (
            <button
              onClick={() => onBrowseDemoDay(event._id)}
              className="py-2 px-4 text-sm h-9 rounded-md font-medium bg-primary text-primary-foreground shadow-sm transition-all hover:bg-teal-700 dark:hover:bg-teal-500 hover:shadow-md"
            >
              Browse
            </button>
          ) : (
            <>
              {!isJudge && !isPastSection && (
                <button
                  onClick={() => onAddTeam(event)}
                  disabled={addTeamDisabled}
                  title={addTeamDisabled ? "Team submissions are temporarily disabled" : undefined}
                  className={`text-sm font-semibold px-4 py-2 rounded-md transition-all ${
                    addTeamDisabled
                      ? "opacity-60 cursor-not-allowed bg-muted text-muted-foreground"
                      : isParticipant 
                        ? "text-primary bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 hover:shadow-sm" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted hover:shadow-sm"
                  }`}
                >
                  {isParticipant ? "View Team" : "Add Team"}
                </button>
              )}
              
              {!userRole ? (
                <button
                  onClick={() => void onJoinAsJudge(event._id)}
                  disabled={isJoining}
                  className="py-2 px-4 text-sm h-9 rounded-md font-medium border border-border bg-card text-foreground shadow-sm transition-all hover:bg-muted hover:border-primary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isJoining ? "Joining..." : "Join as Judge"}
                </button>
              ) : (
                <div className={`text-sm font-bold px-4 py-1.5 rounded-full border ${
                  isJudge
                    ? "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20"
                    : "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
                }`}>
                  Registered
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
