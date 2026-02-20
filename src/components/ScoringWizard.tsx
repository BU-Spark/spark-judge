import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import clsx from "clsx";

type Team = {
  _id: Id<"teams">;
  name: string;
  description: string;
  members: string[];
};

type ExistingScore = {
  teamId: Id<"teams">;
  categoryScores: {
    category: string;
    score: number | null;
    optedOut?: boolean;
  }[];
};

type Category = {
  name: string;
  optOutAllowed?: boolean;
};

type CategoryScoreValue = {
  score: number | null;
  optedOut?: boolean;
};

type ScoringWizardProps = {
  eventId: Id<"events">;
  teams: Team[];
  categories: Category[];
  existingScores?: ExistingScore[];
  storageKey: string | null;
  onClose: () => void;
  onSubmitted: () => void;
};

type DraftStoragePayload = {
  scores: Record<string, Record<string, CategoryScoreValue>>;
  completed: string[];
  skipped: string[];
  currentIndex: number;
  timestamp: number;
};

const DEFAULT_SCORE = 3;

type ReviewStatus = "completed" | "skipped" | "pending";

const REVIEW_SECTIONS: { key: ReviewStatus; title: string }[] = [
  { key: "completed", title: "Completed" },
  { key: "skipped", title: "Skipped" },
  { key: "pending", title: "Incomplete" },
];

export function ScoringWizard({
  eventId,
  teams,
  categories,
  existingScores,
  storageKey,
  onClose,
  onSubmitted,
}: ScoringWizardProps) {
  const submitBatchScores = useMutation(api.scores.submitBatchScores);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  );

  const [draftScores, setDraftScores] = useState<
    Record<string, Record<string, CategoryScoreValue>>
  >({});
  const [completedTeams, setCompletedTeams] = useState<Set<string>>(
    () => new Set()
  );
  const [skippedTeams, setSkippedTeams] = useState<Set<string>>(
    () => new Set()
  );
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<ReviewStatus, boolean>>({
    completed: true,
    skipped: true,
    pending: true,
  });
  const [navHistory, setNavHistory] = useState<number[]>([]);

  const totalTeams = sortedTeams.length;
  const completedCount = completedTeams.size;
  const progressPercent =
    totalTeams === 0 ? 0 : Math.round((completedCount / totalTeams) * 100);
  const hasTeams = totalTeams > 0;
  const currentTeam =
    hasTeams && currentTeamIndex >= 0 && currentTeamIndex < totalTeams
      ? sortedTeams[currentTeamIndex]
      : null;
  const currentTeamId = currentTeam?._id as string | undefined;

  const filledScoresForTeam = useCallback(
    (teamId: string) => {
      const existing = draftScores[teamId] || {};
      const filled: Record<string, CategoryScoreValue> = {};
      categories.forEach(({ name }) => {
        const current = existing[name];
        if (current) {
          filled[name] = {
            score: current.optedOut ? null : current.score ?? DEFAULT_SCORE,
            optedOut: current.optedOut ?? current.score === null,
          };
          return;
        }
        filled[name] = { score: DEFAULT_SCORE, optedOut: false };
      });
      return filled;
    },
    [categories, draftScores]
  );

  useEffect(() => {
    if (!draftLoaded || !existingScores || existingScores.length === 0) return;

    setDraftScores((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, Record<string, CategoryScoreValue>> = {};
      existingScores.forEach((score) => {
        const key = score.teamId as string;
        next[key] = score.categoryScores.reduce<Record<string, CategoryScoreValue>>(
          (acc, cs) => {
            acc[cs.category] = {
              score: cs.optedOut ? null : cs.score ?? DEFAULT_SCORE,
              optedOut: cs.optedOut ?? cs.score === null,
            };
            return acc;
          },
          {}
        );
      });
      return next;
    });

    setCompletedTeams((prev) => {
      if (prev.size > 0) return prev;
      return new Set(existingScores.map((score) => score.teamId as string));
    });
  }, [existingScores, draftLoaded]);

  useEffect(() => {
    if (draftLoaded || !storageKey) return;
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftStoragePayload;
        const normalizedScores: Record<string, Record<string, CategoryScoreValue>> = {};
        Object.entries(parsed.scores ?? {}).forEach(([teamId, categories]) => {
          const normalizedCategories: Record<string, CategoryScoreValue> = {};
          Object.entries(categories as Record<string, any>).forEach(([categoryName, value]) => {
            if (value && typeof value === "object" && "score" in (value as any)) {
              const obj = value as any;
              normalizedCategories[categoryName] = {
                score: obj.optedOut ? null : obj.score ?? DEFAULT_SCORE,
                optedOut: obj.optedOut ?? obj.score === null,
              };
            } else if (typeof value === "number") {
              normalizedCategories[categoryName] = { score: value, optedOut: false };
            }
          });
          normalizedScores[teamId] = normalizedCategories;
        });
        setDraftScores(normalizedScores);
        setCompletedTeams(new Set(parsed.completed ?? []));
        setSkippedTeams(new Set(parsed.skipped ?? []));
        if (parsed.currentIndex >= 0 && parsed.currentIndex < sortedTeams.length) {
          setCurrentTeamIndex(parsed.currentIndex);
        }
      }
    } catch (error) {
      console.error("Failed to load draft scores", error);
    } finally {
      setDraftLoaded(true);
    }
  }, [storageKey, sortedTeams.length, draftLoaded]);

  useEffect(() => {
    if (!draftLoaded || !storageKey) return;
    if (typeof window === "undefined") return;

    const payload: DraftStoragePayload = {
      scores: draftScores,
      completed: Array.from(completedTeams),
      skipped: Array.from(skippedTeams),
      currentIndex: currentTeamIndex,
      timestamp: Date.now(),
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist scoring draft", error);
    }
  }, [
    draftScores,
    completedTeams,
    skippedTeams,
    currentTeamIndex,
    storageKey,
    draftLoaded,
  ]);

  const handleScoreSelect = useCallback(
    (category: string, value: number) => {
      if (!currentTeamId) return;
      setDraftScores((prev) => {
        const next = { ...prev };
        const existing = { ...(next[currentTeamId] ?? {}) };
        existing[category] = { score: value, optedOut: false };
        next[currentTeamId] = existing;
        return next;
      });
    },
    [currentTeamId]
  );

  const handleOptOut = useCallback(
    (category: string) => {
      if (!currentTeamId) return;
      setDraftScores((prev) => {
        const next = { ...prev };
        const existing = { ...(next[currentTeamId] ?? {}) };
        const current = existing[category];
        const isCurrentlyOptedOut = current?.optedOut;
        existing[category] = isCurrentlyOptedOut
          ? { score: current?.score ?? DEFAULT_SCORE, optedOut: false }
          : { score: null, optedOut: true };
        next[currentTeamId] = existing;
        return next;
      });
    },
    [currentTeamId]
  );

  const markTeamCompleted = useCallback(
    (teamId: string) => {
      setDraftScores((prev) => ({
        ...prev,
        [teamId]: filledScoresForTeam(teamId),
      }));
      setCompletedTeams((prev) => {
        const next = new Set(prev);
        next.add(teamId);
        return next;
      });
      setSkippedTeams((prev) => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
    },
    [filledScoresForTeam]
  );

  const markTeamSkipped = useCallback((teamId: string) => {
    setSkippedTeams((prev) => {
      const next = new Set(prev);
      next.add(teamId);
      return next;
    });
    setCompletedTeams((prev) => {
      const next = new Set(prev);
      next.delete(teamId);
      return next;
    });
  }, []);

  const computeNextIndex = useCallback(
    (completedSet: Set<string>, skippedSet: Set<string>) => {
      const firstIncomplete = sortedTeams.findIndex(
        (t) => !completedSet.has(t._id as string) && !skippedSet.has(t._id as string)
      );
      if (firstIncomplete !== -1) return firstIncomplete;
      const firstSkipped = sortedTeams.findIndex((t) => skippedSet.has(t._id as string));
      if (firstSkipped !== -1) return firstSkipped;
      return -1;
    },
    [sortedTeams]
  );

  const handleAdvance = useCallback(() => {
    if (!currentTeam || !currentTeamId) return;
    // record current position for reverse navigation
    setNavHistory((prev) => [...prev, currentTeamIndex]);

    const nextCompleted = new Set(completedTeams);
    nextCompleted.add(currentTeamId);
    const nextSkipped = new Set(skippedTeams);
    nextSkipped.delete(currentTeamId);

    // Persist completion + default scores
    setDraftScores((prev) => ({ ...prev, [currentTeamId]: filledScoresForTeam(currentTeamId) }));
    setCompletedTeams(nextCompleted);
    setSkippedTeams(nextSkipped);

    const nextIdx = computeNextIndex(nextCompleted, nextSkipped);
    if (nextIdx === -1) setIsReviewing(true);
    else setCurrentTeamIndex(nextIdx);
  }, [
    completedTeams,
    computeNextIndex,
    currentTeam,
    currentTeamId,
    currentTeamIndex,
    filledScoresForTeam,
    skippedTeams,
  ]);

  const handlePrevious = useCallback(() => {
    setIsReviewing(false);
    setNavHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      const last = prev[prev.length - 1];
      if (last !== undefined) setCurrentTeamIndex(last);
      return next;
    });
  }, []);

  const handleSkip = useCallback(() => {
    if (!currentTeamId) return;
    // record current position for reverse navigation
    setNavHistory((prev) => [...prev, currentTeamIndex]);
    const nextSkipped = new Set(skippedTeams);
    nextSkipped.add(currentTeamId);
    const nextCompleted = new Set(completedTeams);
    nextCompleted.delete(currentTeamId);
    setSkippedTeams(nextSkipped);
    setCompletedTeams(nextCompleted);

    const nextIdx = computeNextIndex(nextCompleted, nextSkipped);
    if (nextIdx === -1) setIsReviewing(true);
    else setCurrentTeamIndex(nextIdx);
  }, [completedTeams, computeNextIndex, currentTeamId, currentTeamIndex, skippedTeams]);

  // Ensure current position is always the first incomplete; then skipped; else summary
  useEffect(() => {
    if (!hasTeams) return;
    // if current team is pending, keep it
    const id = currentTeamId;
    const isPending = id && !completedTeams.has(id) && !skippedTeams.has(id);
    if (isPending) return;
    const nextIdx = computeNextIndex(completedTeams, skippedTeams);
    if (nextIdx === -1) setIsReviewing(true);
    else setCurrentTeamIndex(nextIdx);
  }, [
    hasTeams,
    currentTeamId,
    completedTeams,
    skippedTeams,
    computeNextIndex,
  ]);

  const handleGoToTeam = useCallback((index: number) => {
    if (index < 0 || index >= totalTeams) return;
    setNavHistory((prev) => (currentTeamIndex >= 0 ? [...prev, currentTeamIndex] : prev));
    setCurrentTeamIndex(index);
    setIsReviewing(false);
  }, [currentTeamIndex, totalTeams]);

  const handleSubmitAll = useCallback(async () => {
    if (completedCount === 0) {
      toast.error("Score at least one team before submitting.");
      return;
    }

    const incompleteCount = totalTeams - completedCount;
    if (incompleteCount > 0) {
      const confirmed = window.confirm(
        `You have ${incompleteCount} incomplete team${incompleteCount === 1 ? '' : 's'}. These teams will not be scored. Submit anyway?`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const payload = sortedTeams
        .filter((team) => completedTeams.has(team._id as string))
        .map((team) => {
          const teamId = team._id as string;
          const scores = filledScoresForTeam(teamId);
          return {
            teamId: team._id,
            categoryScores: categories.map(({ name }) => {
              const entry = scores[name];
              const optedOut = entry?.optedOut ?? false;
              const scoreValue =
                optedOut || entry?.score === null
                  ? null
                  : entry?.score ?? DEFAULT_SCORE;
              return {
                category: name,
                score: scoreValue,
                optedOut,
              };
            }),
          };
        });

      if (payload.length === 0) {
        toast.error("No completed teams to submit.");
        return;
      }

      await submitBatchScores({ eventId, scores: payload });

      if (storageKey && typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey);
      }

      toast.success("Scores submitted successfully!");
      onSubmitted();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to submit scores");
    } finally {
      setSubmitting(false);
    }
  }, [
    categories,
    completedTeams,
    completedCount,
    eventId,
    filledScoresForTeam,
    onSubmitted,
    sortedTeams,
    storageKey,
    submitBatchScores,
    totalTeams,
  ]);

  const summaryEntries = useMemo(
    () =>
      sortedTeams.map((team, index) => {
        const id = team._id as string;
        let status: ReviewStatus = "pending";
        if (completedTeams.has(id)) status = "completed";
        else if (skippedTeams.has(id)) status = "skipped";
        return {
          team,
          index,
          status,
          scores: filledScoresForTeam(id),
        };
      }),
    [sortedTeams, completedTeams, skippedTeams, filledScoresForTeam]
  );

  const toggleSection = useCallback((status: ReviewStatus) => {
    setExpandedSections((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  }, []);

  if (!hasTeams) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">
              No Teams Available
            </h2>
            <p className="text-sm text-muted-foreground">
              There are currently no teams to score for this event.
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </header>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>
              {completedCount} of {totalTeams} teams scored
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReviewing ? (
            <button
              onClick={() => setIsReviewing(false)}
              className="btn-ghost"
            >
              Back to Scoring
            </button>
          ) : (
            <button
              onClick={() => setIsReviewing(true)}
              className="btn-ghost"
            >
              View Summary
            </button>
          )}
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Exit
          </button>
        </div>
      </header>

      {isReviewing ? (
        <ReviewPanel
          entries={summaryEntries}
          onBack={() => setIsReviewing(false)}
          onEdit={handleGoToTeam}
          onSubmit={handleSubmitAll}
          submitting={submitting}
          skippedCount={skippedTeams.size}
          completedCount={completedCount}
          totalTeams={totalTeams}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        />
      ) : (
        currentTeam && (
          <div className="flex-1 overflow-y-auto px-6 py-8 pb-16 flex justify-center">
            <div className="w-full max-w-3xl space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-3xl font-heading font-bold text-foreground">
                  {currentTeam.name}
                </h2>
              </div>

              <div className="space-y-5 flex flex-col items-center">
                {categories.map(({ name, optOutAllowed }) => {
                  const teamId = currentTeam._id as string;
                  const selection = draftScores[teamId]?.[name];
                  const isOptedOut = selection?.optedOut;
                  const selected =
                    isOptedOut || selection?.score === null
                      ? null
                      : selection?.score ?? DEFAULT_SCORE;
                  return (
                    <div
                      key={name}
                      className="space-y-2 w-full max-w-xl"
                    >
                      <div className="text-center">
                        <label className="text-lg font-semibold text-foreground">
                          {name}
                        </label>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-center">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            onClick={() => handleScoreSelect(name, value)}
                            className={clsx(
                              "w-12 h-12 rounded-xl font-semibold text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary",
                              selected === value && !isOptedOut
                                ? "bg-primary text-white scale-110 shadow-lg shadow-teal-500/30"
                                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:scale-105",
                              isOptedOut && "opacity-50"
                            )}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      {optOutAllowed && (
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handleOptOut(name)}
                            className={clsx(
                              "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                              isOptedOut
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "text-muted-foreground border-border hover:border-amber-500/50 hover:text-amber-600"
                            )}
                          >
                            {isOptedOut ? "Marked as N/A" : "I'm not comfortable judging this category"}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            Marks this category as neutral and skips scoring it.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      )}

      {!isReviewing && (
        <footer className="px-6 py-4 border-t border-border bg-background/95 backdrop-blur flex flex-wrap gap-3 justify-center">
          <div className="flex flex-wrap gap-3 justify-center w-full max-w-xl">
            <button
              onClick={handlePrevious}
              className="btn-secondary"
              disabled={navHistory.length === 0}
            >
              Previous
            </button>
            <button onClick={handleSkip} className="btn-ghost">
              Skip
            </button>
            <button onClick={handleAdvance} className="btn-primary">
              Next
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

type ReviewEntry = {
  team: Team;
  index: number;
  status: ReviewStatus;
  scores: Record<string, CategoryScoreValue>;
};

function ReviewPanel({
  entries,
  onBack,
  onEdit,
  onSubmit,
  submitting,
  skippedCount,
  completedCount,
  totalTeams,
  expandedSections,
  onToggleSection,
}: {
  entries: ReviewEntry[];
  onBack: () => void;
  onEdit: (index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  skippedCount: number;
  completedCount: number;
  totalTeams: number;
  expandedSections: Record<ReviewStatus, boolean>;
  onToggleSection: (status: ReviewStatus) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">
              Review Scores
            </h2>
            <p className="text-sm text-muted-foreground">
              {completedCount} of {totalTeams} teams scored
              {skippedCount > 0 && ` · ${skippedCount} skipped`}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-500 text-sm border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Completed
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/15 text-amber-500 text-sm border border-amber-500/40">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Skipped
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm border border-border">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              Pending
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {REVIEW_SECTIONS.map(({ key, title }) => {
            const items = entries.filter((entry) => entry.status === key);
            if (items.length === 0) return null;
            const isOpen = expandedSections[key];

            return (
              <section key={key} className="border border-border rounded-xl">
                <button
                  type="button"
                  onClick={() => onToggleSection(key)}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <span className="text-sm font-semibold uppercase tracking-wide text-foreground flex items-center gap-2">
                    {title}
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground border border-border/60">
                      {items.length}
                    </span>
                  </span>
                  <svg
                    className={clsx(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      isOpen ? "rotate-180" : ""
                    )}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="divide-y divide-border">
                    {items.map(({ team, index, status, scores }) => (
                      <div
                        key={team._id}
                        className={clsx(
                          "px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/30 transition-colors",
                          status === "completed" && "bg-emerald-500/5",
                          status === "skipped" && "bg-amber-500/5"
                        )}
                      >
                        {/* Team name and status */}
                        <div className="flex items-center gap-2 sm:min-w-[200px] sm:flex-shrink-0">
                          <span
                            className={clsx(
                              "w-2 h-2 rounded-full flex-shrink-0",
                              status === "completed" && "bg-emerald-500",
                              status === "skipped" && "bg-amber-500",
                              status === "pending" && "bg-muted-foreground"
                            )}
                          />
                          <span className="font-medium text-foreground truncate">
                            {team.name}
                          </span>
                        </div>

                        {/* Scores - responsive layout */}
                        <div className="flex-1 min-w-0">
                          {status !== "pending" ? (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              {Object.entries(scores).map(([category, scoreValue]) => {
                                const isOptedOut = scoreValue.optedOut;
                                const displayScore =
                                  isOptedOut || scoreValue.score === null
                                    ? "N/A"
                                    : scoreValue.score;
                                return (
                                  <span key={category} className="text-muted-foreground whitespace-nowrap">
                                    <span className="hidden sm:inline">{category}: </span>
                                    <span className="sm:hidden">{category.slice(0, 3)}: </span>
                                    <span
                                      className={clsx(
                                        "font-semibold",
                                        isOptedOut ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                                      )}
                                    >
                                      {displayScore}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              Not scored
                            </span>
                          )}
                        </div>

                        {/* Edit button */}
                        <button
                          onClick={() => onEdit(index)}
                          className="btn-ghost text-sm px-3 py-1.5 sm:ml-auto flex-shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-border">
          <button onClick={onBack} className="btn-secondary">
            Back to Scoring
          </button>
          <button
            onClick={onSubmit}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={submitting || completedCount === 0}
          >
            {submitting ? "Submitting..." : "Submit All Scores"}
          </button>
        </div>
      </div>
    </div>
  );
}
