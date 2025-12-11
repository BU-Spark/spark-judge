import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAttendeeIdentity } from "../../lib/demoDayIdentity";
import { useAppreciation } from "../../lib/demoDayApi";
import { toast } from "sonner";
import { LoadingState } from "../ui/LoadingState";
import { Link } from "react-router-dom";

interface DemoDayBrowseProps {
  eventId: Id<"events">;
  event: {
    name: string;
    description: string;
    startDate: number;
    endDate: number;
    status: string;
    teams: Array<{
      _id: Id<"teams">;
      name: string;
      description: string;
      members?: string[];
      courseCode?: string;
      hidden?: boolean;
    }>;
  };
  onBack: () => void;
}

export function DemoDayBrowse({ eventId, event, onBack }: DemoDayBrowseProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [quickTeam, setQuickTeam] = useState<
    | (DemoDayBrowseProps["event"]["teams"][number] & {
        appreciationData?: { totalCount: number; attendeeCount: number };
      })
    | null
  >(null);
  const [sheetHeight, setSheetHeight] = useState(260);
  const courseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Get attendee identity
  const { attendeeId, isLoading: identityLoading } = useAttendeeIdentity();

  // Get appreciation data
  const appreciationData = useQuery(
    api.appreciations.getTeamAppreciations,
    attendeeId ? { eventId, attendeeId } : "skip"
  );
  const maxPerAttendee = appreciationData?.maxPerAttendee ?? 100;
  const maxPerTeam = appreciationData?.maxPerTeam ?? 3;
  const remainingBudget =
    appreciationData?.attendeeRemainingBudget ?? maxPerAttendee;

  // Get unique course codes for filter chips
  const courseCodes = useMemo(() => {
    const codes = new Set<string>();
    event.teams.forEach((team) => {
      if (team.courseCode) {
        codes.add(team.courseCode);
      }
    });
    return Array.from(codes).sort();
  }, [event.teams]);

  // Filter teams
  const filteredTeams = useMemo(() => {
    return event.teams
      .filter((team) => !team.hidden)
      .filter((team) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (
            !team.name.toLowerCase().includes(query) &&
            !team.description.toLowerCase().includes(query) &&
            !(team.members || []).some((m) => m.toLowerCase().includes(query))
          ) {
            return false;
          }
        }
        // Course filter
        if (selectedCourse && team.courseCode !== selectedCourse) {
          return false;
        }
        return true;
      });
  }, [event.teams, searchQuery, selectedCourse]);

  // Group teams by course when viewing all courses
  const teamsByCourse = useMemo(() => {
    if (selectedCourse !== null) {
      // When a specific course is selected, return null to use flat display
      return null;
    }

    const grouped = new Map<string, typeof filteredTeams>();
    
    // Add teams with course codes
    filteredTeams.forEach((team) => {
      const course = team.courseCode || "Other";
      if (!grouped.has(course)) {
        grouped.set(course, []);
      }
      grouped.get(course)!.push(team);
    });

    // Sort courses and teams within each course
    const sorted = Array.from(grouped.entries()).sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });

    sorted.forEach(([_, teams]) => {
      teams.sort((a, b) => a.name.localeCompare(b.name));
    });

    return sorted;
  }, [filteredTeams, selectedCourse]);

  // Build appreciation lookup map
  const appreciationMap = useMemo(() => {
    const map = new Map<
      string,
      { totalCount: number; attendeeCount: number }
    >();
    appreciationData?.teams.forEach((team) => {
      map.set(team.teamId, {
        totalCount: team.totalCount,
        attendeeCount: team.attendeeCount,
      });
    });
    return map;
  }, [appreciationData]);

  const isEventLive = event.status === "active";

  if (identityLoading) {
    return <LoadingState label="Initializing..." />;
  }

  const scrollToCourse = (code: string | null) => {
    if (code === null) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = courseRefs.current[code];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 sm:pb-8">
      {/* Mobile header (compact) */}
      <div className="sm:hidden mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-0 text-xs p-0 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded"
            aria-label="Back to events"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold text-foreground truncate max-w-[80vw]">
            {event.name}
          </h1>
        </div>
      </div>

      {/* Desktop header (card layout) */}
      <div className="hidden sm:block">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm btn-ghost mb-6"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Events
        </button>

        <div className="card-static p-6 mb-8 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-heading font-bold text-foreground">
                  {event.name}
                </h1>
              </div>
              <p className="text-muted-foreground">{event.description}</p>
            </div>
            <div>
              <BudgetIndicator remaining={remainingBudget} total={maxPerAttendee} />
            </div>
          </div>
        </div>
      </div>

      {!isEventLive && (
        <div className="card-static p-3 sm:p-4 mb-5 sm:mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100 rounded-lg text-sm">
          Appreciations open once the event is live.
        </div>
      )}

      {/* Search and Filters */}
      <div className="card-static relative mb-5 sm:mb-6 p-3 sm:p-4 bg-card overflow-hidden">
        <div className="space-y-3 sm:space-y-4">
          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search projects by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground text-sm"
            />
          </div>

          {/* Course Filter Chips */}
          {courseCodes.length > 0 && (
            <div className="sticky top-0 z-20 w-full bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm overflow-hidden relative">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-auto-hide px-3 w-full">
                <button
                  onClick={() => {
                    setSelectedCourse(null);
                    scrollToCourse(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border whitespace-nowrap ${
                    selectedCourse === null
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  All Courses
                </button>
                {courseCodes.map((code) => (
                  <button
                    key={code}
                    onClick={() => {
                      const next =
                        selectedCourse === code ? null : code;
                      setSelectedCourse(next);
                      scrollToCourse(code);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border whitespace-nowrap ${
                      selectedCourse === code
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card via-card/70 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card via-card/70 to-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredTeams.length} project
          {filteredTeams.length !== 1 ? "s" : ""}
          {selectedCourse && ` in ${selectedCourse}`}
        </p>
      </div>

      {/* Team Grid - Grouped by course when viewing all, flat when filtered */}
      {filteredTeams.length === 0 ? (
        <div className="card-static text-center py-12 bg-card">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
            No Projects Found
          </h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search terms"
              : "No projects match the selected filters"}
          </p>
        </div>
      ) : teamsByCourse ? (
        // Grouped by course view (All Courses selected)
        <div className="space-y-8">
          {teamsByCourse.map(([courseCode, teams]) => (
            <div
              key={courseCode}
              className="space-y-4 scroll-mt-24"
              id={`course-${courseCode}`}
              ref={(el) => {
                courseRefs.current[courseCode] = el;
              }}
            >
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-heading font-bold text-foreground">
                  {courseCode}
                </h2>
                <span className="text-sm text-muted-foreground">
                  ({teams.length} project{teams.length !== 1 ? "s" : ""})
                </span>
              </div>
              <div
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:overflow-visible md:snap-none scrollbar-auto-hide"
                aria-label={`${courseCode} projects`}
              >
                {teams.map((team, index) => (
                  <TeamCard
                    key={team._id}
                    team={team}
                    eventId={eventId}
                    attendeeId={attendeeId}
                    appreciationData={appreciationMap.get(team._id)}
                    remainingBudget={remainingBudget}
                    maxPerTeam={maxPerTeam}
                    index={index}
                    isEventLive={isEventLive}
                    onQuickView={(enrichedTeam) =>
                      setQuickTeam({
                        ...enrichedTeam,
                        appreciationData: appreciationMap.get(team._id),
                      })
                    }
                    layout="carousel"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat grid view (specific course selected)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team, index) => (
            <TeamCard
              key={team._id}
              team={team}
              eventId={eventId}
              attendeeId={attendeeId}
              appreciationData={appreciationMap.get(team._id)}
              remainingBudget={remainingBudget}
              maxPerTeam={maxPerTeam}
              index={index}
              isEventLive={isEventLive}
              onQuickView={(enrichedTeam) =>
                setQuickTeam({
                  ...enrichedTeam,
                  appreciationData: appreciationMap.get(team._id),
                })
              }
            />
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {quickTeam && (
          <QuickViewSheet
            key={quickTeam._id}
            team={quickTeam}
            onClose={() => setQuickTeam(null)}
            eventId={eventId}
            attendeeId={attendeeId}
            remainingBudget={remainingBudget}
            maxPerTeam={maxPerTeam}
            maxPerAttendee={maxPerAttendee}
            onHeightChange={(h) => setSheetHeight(h)}
            isEventLive={isEventLive}
          />
        )}
      </AnimatePresence>
      <MobileBudgetFooter
        remaining={remainingBudget}
        total={maxPerAttendee}
        lifted={!!quickTeam}
        liftAmount={sheetHeight + 24}
      />
    </div>
  );
}

function BudgetIndicator({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const percentage = (remaining / total) * 100;
  const isLow = remaining <= 3;

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1.5 mb-3 text-right whitespace-nowrap">
        <span className="text-xl leading-none">❤️</span>
        <span
          className={`text-2xl font-bold leading-none ${
            isLow ? "text-red-500" : "text-foreground"
          }`}
        >
          {remaining}
        </span>
        <span className="text-muted-foreground text-sm leading-tight">
          / {total} left
        </span>
      </div>
      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isLow ? "bg-red-500" : "bg-pink-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface TeamCardProps {
  team: {
    _id: Id<"teams">;
    name: string;
    description: string;
    members?: string[];
    courseCode?: string;
  };
  eventId: Id<"events">;
  attendeeId: string | null;
  appreciationData?: { totalCount: number; attendeeCount: number };
  remainingBudget: number;
  maxPerTeam: number;
  index: number;
  onQuickView?: (team: TeamCardProps["team"]) => void;
  layout?: "grid" | "carousel";
  isEventLive: boolean;
}

function TeamCard({
  team,
  eventId,
  attendeeId,
  appreciationData,
  remainingBudget,
  maxPerTeam,
  index,
  onQuickView,
  layout = "grid",
  isEventLive,
}: TeamCardProps) {
  const { appreciate, isLoading } = useAppreciation();
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  const attendeeCount = optimisticCount ?? appreciationData?.attendeeCount ?? 0;
  const canAppreciate =
    isEventLive && attendeeId && attendeeCount < maxPerTeam && remainingBudget > 0;

  const handleAppreciate = async () => {
    if (!attendeeId || !canAppreciate) return;

    // Optimistic update
    setOptimisticCount((prev) => (prev ?? attendeeCount) + 1);

    const result = await appreciate(
      eventId,
      team._id,
      () => {
        toast.success(`Appreciated ${team.name}!`);
      },
      (error) => {
        // Revert optimistic update
        setOptimisticCount(null);
        toast.error(error);
      }
    );

    // If successful, the query will refresh and we can clear optimistic state
    if (result.success) {
      // Let the query update handle the final state
      setTimeout(() => setOptimisticCount(null), 500);
    }
  };

  return (
    <div
      className={`card fade-in p-5 bg-card hover:shadow-lg transition-all duration-200 ${
        layout === "carousel"
          ? "min-w-[80%] sm:min-w-[60%] md:min-w-0"
          : ""
      }`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <Link
              to={`/event/${eventId}/team/${team._id}`}
              className="font-heading font-semibold text-foreground text-base truncate block hover:text-primary transition-colors"
            >
              {team.name}
            </Link>
            {team.courseCode && (
              <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[10px] rounded mt-1">
                {team.courseCode}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground flex-1 line-clamp-3 mb-4 leading-relaxed">
          {team.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
          {onQuickView ? (
            <>
              <button
                onClick={() => onQuickView(team)}
                className="text-xs text-primary hover:underline font-medium sm:hidden"
              >
                View Details →
              </button>
              <Link
                to={`/event/${eventId}/team/${team._id}`}
                className="text-xs text-primary hover:underline font-medium hidden sm:inline"
              >
                View Details →
              </Link>
            </>
          ) : (
            <Link
              to={`/event/${eventId}/team/${team._id}`}
              className="text-xs text-primary hover:underline font-medium"
            >
              View Details →
            </Link>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {attendeeCount}/{maxPerTeam}
            </span>
            <button
              onClick={() => {
                void handleAppreciate();
              }}
              disabled={!canAppreciate || isLoading}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all shadow-sm
                ${
                  canAppreciate
                    ? "bg-pink-500 hover:bg-pink-600 text-white hover:shadow-md active:scale-95"
                    : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                }
                ${isLoading ? "opacity-70" : ""}
              `}
            >
              {isLoading ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>❤️</span>
              )}
              {!isEventLive
                ? "Opens when live"
                : attendeeCount >= maxPerTeam
                  ? "Max"
                  : remainingBudget <= 0
                    ? "None Left"
                    : "+1"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuickViewSheetProps {
  team: (TeamCardProps["team"] & {
    appreciationData?: { totalCount: number; attendeeCount: number };
  }) | null;
  onClose: () => void;
  eventId: Id<"events">;
  attendeeId: string | null;
  remainingBudget: number;
  maxPerTeam: number;
  maxPerAttendee: number;
  onHeightChange: (height: number) => void;
  isEventLive: boolean;
}

function QuickViewSheet({
  team,
  onClose,
  eventId,
  attendeeId,
  remainingBudget,
  maxPerTeam,
  maxPerAttendee,
  onHeightChange,
  isEventLive,
}: QuickViewSheetProps) {
  const { appreciate, isLoading } = useAppreciation();
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Measure sheet height to lift footer appropriately
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height) {
        onHeightChange(rect.height);
      }
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, team]);

  if (!team) return null;

  const attendeeCount =
    optimisticCount ?? team.appreciationData?.attendeeCount ?? 0;
  const canAppreciate =
    isEventLive && attendeeId && attendeeCount < maxPerTeam && remainingBudget > 0;

  const handleAppreciate = async () => {
    if (!attendeeId || !canAppreciate) return;
    setOptimisticCount((prev) => (prev ?? attendeeCount) + 1);

    const result = await appreciate(
      eventId,
      team._id,
      () => {
        toast.success(`Appreciated ${team.name}!`);
      },
      (error) => {
        setOptimisticCount(null);
        toast.error(error);
      }
    );

    if (result.success) {
      setTimeout(() => setOptimisticCount(null), 500);
    }
  };

  return (
    <>
      <motion.div
        key="overlay"
        className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.25 } }}
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
        role="button"
        aria-label="Close quick view"
        onClick={onClose}
      />
      <motion.div
        key="sheet"
        className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl shadow-2xl border border-border p-4 max-h-[80vh] overflow-y-auto will-change-transform"
        ref={sheetRef}
        initial={{ y: "100%" }}
        animate={{
          y: 0,
          transition: { duration: 0.25, ease: [0.25, 0.8, 0.3, 1] },
        }}
        exit={{
          y: "100%",
          transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
        }}
      >
        <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full mx-auto mb-3" />
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground">
              {team.name}
            </h3>
            {team.courseCode && (
              <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[10px] rounded mt-1">
                {team.courseCode}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl -mt-2 mr-2"
            aria-label="Close quick view"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {team.description}
        </p>
        {team.members && team.members.length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Members
            </p>
            <div className="flex flex-wrap gap-2">
              {team.members.map((member) => (
                <span
                  key={member}
                  className="px-2 py-1 bg-muted text-xs rounded-md text-foreground"
                >
                  {member}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3 gap-3">
          <span className="text-xs text-muted-foreground">
            {attendeeCount}/{maxPerTeam} you’ve given • {remainingBudget}/{maxPerAttendee} left
          </span>
          <button
            onClick={() => {
              void handleAppreciate();
            }}
            disabled={!canAppreciate || isLoading}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all shadow-sm
              ${
                canAppreciate
                  ? "bg-pink-500 hover:bg-pink-600 text-white hover:shadow-md active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
              }
              ${isLoading ? "opacity-70" : ""}
            `}
          >
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>❤️</span>
            )}
            {!isEventLive
              ? "Opens when live"
              : attendeeCount >= maxPerTeam
                ? "Max"
                : remainingBudget <= 0
                  ? "None Left"
                  : "Appreciate"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function MobileBudgetFooter({
  remaining,
  total,
  lifted,
  liftAmount,
}: {
  remaining: number;
  total: number;
  lifted: boolean;
  liftAmount: number;
}) {
  return (
    <motion.div
      className="fixed bottom-0 inset-x-0 z-[60] sm:hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] pt-2"
      initial={false}
      animate={{
        y: lifted ? -Math.max(liftAmount, 120) : 0,
        transition: { duration: 0.25, ease: [0.25, 0.8, 0.3, 1] },
      }}
    >
      <div className="bg-primary text-primary-foreground border border-primary rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.22)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.32)] px-3 py-2 flex items-center gap-2 w-fit mx-auto text-sm">
        <span className="text-base leading-none">❤️</span>
        <span className="font-semibold text-sm leading-none">
          {remaining}/{total} appreciations left
        </span>
      </div>
    </motion.div>
  );
}
