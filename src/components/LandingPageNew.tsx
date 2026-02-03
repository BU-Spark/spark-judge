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
import {
  Card,
  Text,
  Title,
  Badge,
  Button,
  Grid,
  Flex,
  ProgressBar,
  Icon,
} from "@tremor/react";
import {
  ClockIcon,
  BoltIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

const withEllipsis = (text: string | undefined, maxLength = 100) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const safeCut =
    lastSpace > maxLength - 40 ? truncated.slice(0, lastSpace) : truncated;

  return `${safeCut.trimEnd()}...`;
};

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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSignIn(false)}
          />
          <div className="relative glass rounded-2xl p-8 max-w-md w-full shadow-2xl slide-up">
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
      <Flex justifyContent="start" alignItems="center" className="gap-3 mb-6">
        <Title>{title}</Title>
        {events.length > 0 && <Badge color="teal">{events.length}</Badge>}
      </Flex>
      {events.length === 0 ? (
        <Card className="text-center py-12">
          <Text>{emptyMessage}</Text>
        </Card>
      ) : (
        <Grid numItemsLg={3} numItemsMd={2} numItemsSm={1} className="gap-6">
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
        </Grid>
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
      <Flex justifyContent="start" alignItems="center" className="gap-3 mb-6">
        <Title>{title}</Title>
        {events.length > 0 && <Badge color="gray">{events.length}</Badge>}
      </Flex>
      {events.length === 0 ? (
        <Text className="py-6 border-b border-tremor-border">
          {emptyMessage}
        </Text>
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

  const truncatedDescription = withEllipsis(event.description, 100);

  return (
    <Card className="flex flex-col h-full snap-start glow-hover border-border/50">
      <Flex className="items-start gap-4 mb-4">
        <Flex flexDirection="col" className="items-start gap-1">
          <Badge color="emerald" icon={BoltIcon}>Live</Badge>
          <Title className="line-clamp-2">{event.name}</Title>
        </Flex>
        <Flex flexDirection="col" className="items-end gap-2 shrink-0">
          {isDemoDay && <Badge color="pink">Demo Day</Badge>}
          {userRole && (
            <Badge color={isJudge ? "violet" : "blue"}>
              {isJudge ? "Judge" : "Participant"}
            </Badge>
          )}
        </Flex>
      </Flex>

      <Text className="flex-grow mb-4 line-clamp-3">
        {truncatedDescription}
      </Text>

      <div className="border-t border-tremor-border pt-4 mt-auto">
        <Flex justifyContent="between" className="mb-6">
          <Text className="flex items-center gap-1.5 font-medium">
            <ClockIcon className="w-4 h-4" />
            {formatDateRange(event.startDate, event.endDate)}
          </Text>
          <Badge color="gray">
            {event.teamCount} {isDemoDay ? "projects" : "teams"}
          </Badge>
        </Flex>

        {isJudge && judgeProgress && !isDemoDay && (
          <div className="mb-4">
            <Flex className="mb-1">
              <Text className="text-xs">Judging Progress</Text>
              <Text color="gray" className="text-xs">{judgeProgress.completedTeams}/{judgeProgress.totalTeams}</Text>
            </Flex>
            <ProgressBar value={(judgeProgress.completedTeams / judgeProgress.totalTeams) * 100} color="violet" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isDemoDay && (
            <Button
              onClick={() => onBrowseDemoDay(event._id)}
              className="w-full"
              icon={MagnifyingGlassIcon}
            >
              Browse & Appreciate
            </Button>
          )}

          {showSideBySide ? (
            <Flex className="gap-2">
              <Button
                onClick={() => void onJoinAsJudge(event._id)}
                disabled={isJoining}
                loading={isJoining}
                variant="secondary"
                className="flex-1"
              >
                Join as Judge
              </Button>
              <Button
                onClick={() => onAddTeam(event)}
                disabled={addTeamTemporarilyDisabled}
                variant="secondary"
                className="flex-1"
                color="gray"
              >
                Add Team
              </Button>
            </Flex>
          ) : (
            <>
              {!isDemoDay && !isParticipant && (
                <>
                  {!isJudge ? (
                    <Button
                      onClick={() => void onJoinAsJudge(event._id)}
                      disabled={isJoining}
                      loading={isJoining}
                      variant="secondary"
                      className="w-full"
                    >
                      Join as Judge
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onStartScoring(event)}
                      className="w-full"
                      color={hasCompletedScoring ? "emerald" : "violet"}
                      icon={hasCompletedScoring ? CheckCircleIcon : ArrowRightIcon}
                    >
                      {hasCompletedScoring ? "Scoring Complete" :
                        (judgeProgress && judgeProgress.completedTeams > 0
                          ? `Resume (${judgeProgress.completedTeams}/${judgeProgress.totalTeams})`
                          : "Start Scoring")}
                    </Button>
                  )}
                </>
              )}

              {!isDemoDay && !isJudge && (
                <Button
                  onClick={() => onAddTeam(event)}
                  disabled={addTeamTemporarilyDisabled}
                  variant={isParticipant ? "primary" : "secondary"}
                  color={isParticipant ? "teal" : "gray"}
                  className="w-full"
                >
                  {isParticipant ? "View/Edit Team" : "Add Your Team"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
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
    <Card className="p-0 overflow-hidden glow-hover border-border/50">
      {/* Mobile Layout */}
      <div className="md:hidden p-4">
        <Flex
          justifyContent="between"
          alignItems="center"
          className="cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex-1 min-w-0 pr-4">
            <Flex justifyContent="start" className="gap-2 mb-1">
              <Text className="text-xs">
                {formatDateTime(event.startDate).split(',')[0]}
              </Text>
              {isDemoDay && (
                <Badge color="pink">
                  Demo Day
                </Badge>
              )}
            </Flex>
            <Title className="truncate">
              {event.name}
            </Title>
            <Text color="gray" className="mt-1 text-xs">
              {event.teamCount} {isDemoDay ? "projects" : "teams"}
            </Text>
          </div>
          <Icon
            icon={ArrowRightIcon}
            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
            color="gray"
            size="sm"
          />
        </Flex>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-tremor-border space-y-3">
            <div className="flex flex-col gap-2">
              {isPastSection ? (
                <Button
                  onClick={() => onStartScoring(event)}
                  variant="secondary"
                  className="w-full"
                >
                  View Results
                </Button>
              ) : isDemoDay ? (
                <Button
                  onClick={() => onBrowseDemoDay(event._id)}
                  className="w-full"
                  icon={MagnifyingGlassIcon}
                >
                  Browse
                </Button>
              ) : (
                <>
                  {!isJudge && !isPastSection && (
                    <Button
                      onClick={() => onAddTeam(event)}
                      disabled={addTeamDisabled}
                      variant="secondary"
                      color="gray"
                      className="w-full"
                    >
                      {isParticipant ? "View Team" : "Add Team"}
                    </Button>
                  )}

                  {!userRole ? (
                    <Button
                      onClick={() => void onJoinAsJudge(event._id)}
                      disabled={isJoining}
                      loading={isJoining}
                      variant="secondary"
                      className="w-full"
                    >
                      Join as Judge
                    </Button>
                  ) : (
                    <Badge color={isJudge ? "violet" : "blue"} className="w-full justify-center">
                      Registered as {userRole === 'judge' ? 'Judge' : 'Participant'}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex p-4 items-center gap-6">
        <div className="flex-shrink-0 w-32 border-r border-tremor-border pr-4">
          <Text className="font-bold">{formatDateTime(event.startDate).split(',')[0]}</Text>
          <Text color="gray" className="text-xs">{formatDateTime(event.startDate).split(',')[1]}</Text>
        </div>

        <div className="flex-grow min-w-0">
          <Title className="truncate mb-1">
            {event.name}
          </Title>
          <Flex justifyContent="start" className="gap-4">
            <Text color="gray" className="text-xs">{event.teamCount} {isDemoDay ? "projects" : "teams"}</Text>
            {isPastSection && event.overallWinner && (
              <Badge color="amber" icon={CheckCircleIcon}>
                Winner announced
              </Badge>
            )}
          </Flex>
        </div>

        <Flex justifyContent="end" className="gap-3 w-auto shrink-0">
          {isDemoDay && <Badge color="pink">Demo Day</Badge>}
          {userRole && (
            <Badge color={isJudge ? "violet" : "blue"}>
              {isJudge ? "Judge" : "Participant"}
            </Badge>
          )}

          {isPastSection ? (
            <Button
              onClick={() => onStartScoring(event)}
              variant="light"
            >
              View Results
            </Button>
          ) : isDemoDay ? (
            <Button
              onClick={() => onBrowseDemoDay(event._id)}
              size="sm"
              icon={MagnifyingGlassIcon}
            >
              Browse
            </Button>
          ) : (
            <>
              {!isJudge && !isPastSection && (
                <Button
                  onClick={() => onAddTeam(event)}
                  disabled={addTeamDisabled}
                  variant="light"
                  color="gray"
                >
                  {isParticipant ? "View Team" : "Add Team"}
                </Button>
              )}

              {!userRole ? (
                <Button
                  onClick={() => void onJoinAsJudge(event._id)}
                  disabled={isJoining}
                  loading={isJoining}
                  variant="secondary"
                  size="sm"
                >
                  Join as Judge
                </Button>
              ) : (
                <Badge color={isJudge ? "violet" : "blue"}>
                  Registered
                </Badge>
              )}
            </>
          )}
        </Flex>
      </div>
    </Card>
  );
}
