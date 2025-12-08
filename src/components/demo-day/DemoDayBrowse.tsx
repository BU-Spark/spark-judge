import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { useAttendeeIdentity } from "../../lib/demoDayIdentity";
import { useAppreciation } from "../../lib/demoDayApi";
import { toast } from "sonner";
import { LoadingState } from "../ui/LoadingState";

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
      courseCode?: string;
      hidden?: boolean;
    }>;
  };
  onBack: () => void;
}

export function DemoDayBrowse({ eventId, event, onBack }: DemoDayBrowseProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Get attendee identity
  const { attendeeId, isLoading: identityLoading } = useAttendeeIdentity();

  // Get appreciation data
  const appreciationData = useQuery(
    api.appreciations.getTeamAppreciations,
    attendeeId ? { eventId, attendeeId } : "skip"
  );

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
            !team.description.toLowerCase().includes(query)
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

  if (identityLoading) {
    return <LoadingState label="Initializing..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 btn-ghost mb-6 fade-in"
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

      {/* Header */}
      <div className="card-glass mb-8 fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                {event.name}
              </h1>
              <span className="badge bg-pink-500/20 text-pink-500 border-pink-500/30">
                Demo Day
              </span>
            </div>
            <p className="text-muted-foreground">{event.description}</p>
          </div>
          <BudgetIndicator
            remaining={appreciationData?.attendeeRemainingBudget ?? 15}
            total={15}
          />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card mb-6 fade-in">
        <div className="space-y-4">
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
              className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
            />
          </div>

          {/* Course Filter Chips */}
          {courseCodes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCourse(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCourse === null
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All Courses
              </button>
              {courseCodes.map((code) => (
                <button
                  key={code}
                  onClick={() =>
                    setSelectedCourse(selectedCourse === code ? null : code)
                  }
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCourse === code
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between mb-4 fade-in">
        <p className="text-muted-foreground">
          Showing {filteredTeams.length} project
          {filteredTeams.length !== 1 ? "s" : ""}
          {selectedCourse && ` in ${selectedCourse}`}
        </p>
      </div>

      {/* Team Grid */}
      {filteredTeams.length === 0 ? (
        <div className="card text-center py-12 fade-in">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
            No Projects Found
          </h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search terms"
              : "No projects match the selected filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team, index) => (
            <TeamCard
              key={team._id}
              team={team}
              eventId={eventId}
              attendeeId={attendeeId}
              appreciationData={appreciationMap.get(team._id)}
              remainingBudget={appreciationData?.attendeeRemainingBudget ?? 15}
              index={index}
            />
          ))}
        </div>
      )}
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
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">❤️</span>
        <span
          className={`text-2xl font-bold ${isLow ? "text-red-500" : "text-foreground"}`}
        >
          {remaining}
        </span>
        <span className="text-muted-foreground">/ {total} left</span>
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
    courseCode?: string;
  };
  eventId: Id<"events">;
  attendeeId: string | null;
  appreciationData?: { totalCount: number; attendeeCount: number };
  remainingBudget: number;
  index: number;
}

function TeamCard({
  team,
  eventId,
  attendeeId,
  appreciationData,
  remainingBudget,
  index,
}: TeamCardProps) {
  const { appreciate, isLoading } = useAppreciation();
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  const totalCount = appreciationData?.totalCount ?? 0;
  const attendeeCount = optimisticCount ?? appreciationData?.attendeeCount ?? 0;
  const maxPerTeam = 3;
  const canAppreciate =
    attendeeId && attendeeCount < maxPerTeam && remainingBudget > 0;

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
      className="card group slide-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-semibold text-foreground text-lg truncate">
              {team.name}
            </h3>
            {team.courseCode && (
              <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded mt-1">
                {team.courseCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-pink-500 ml-2">
            <span className="text-lg">❤️</span>
            <span className="font-bold">{totalCount + (optimisticCount !== null ? 1 : 0)}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground flex-1 line-clamp-3 mb-4">
          {team.description}
        </p>

        {/* Appreciation Button */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {attendeeCount} / {maxPerTeam} given
          </div>
          <button
            onClick={handleAppreciate}
            disabled={!canAppreciate || isLoading}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${
                canAppreciate
                  ? "bg-pink-500 hover:bg-pink-600 text-white hover:scale-105 active:scale-100"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }
              ${isLoading ? "opacity-70" : ""}
            `}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-4 h-4"
                fill={canAppreciate ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            )}
            {attendeeCount >= maxPerTeam
              ? "Max Given"
              : remainingBudget <= 0
                ? "No Budget"
                : "Appreciate"}
          </button>
        </div>
      </div>
    </div>
  );
}

