import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import clsx from "clsx";
import {
  formatRubricPercent,
  getRubricPercentages,
} from "../lib/scoringWeights";
import "./ScoringWizard.fi.css";

type Team = {
  _id: Id<"teams">;
  name: string;
  description: string;
  members: string[];
  track?: string;
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
  weight?: number;
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
  /**
   * Opens the wizard on this team when found in the sorted list.
   * Precedence: a stored draft's `currentIndex` wins if a draft actually exists
   * in localStorage; otherwise `initialTeamId` wins. Unknown ids fall back to
   * the normal first-incomplete / index-0 path.
   */
  initialTeamId?: Id<"teams"> | null;
};

type DraftStoragePayload = {
  scores: Record<string, Record<string, CategoryScoreValue>>;
  completed: string[];
  skipped: string[];
  currentIndex: number;
  timestamp: number;
};

const DEFAULT_SCORE = 3;
const SCORE_VALUES = [1, 2, 3, 4, 5] as const;

type ReviewStatus = "completed" | "skipped" | "pending";

const STAMP_LABEL: Record<ReviewStatus, string> = {
  completed: "Done",
  skipped: "Skipped",
  pending: "Open",
};

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function formatDraftTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function normalizeCategoryValue(value: unknown): CategoryScoreValue | null {
  if (typeof value === "number") {
    return { score: value, optedOut: false };
  }
  if (isRecord(value) && "score" in value) {
    const optedOut = Boolean(value.optedOut) || value.score === null;
    const scoreRaw = value.score;
    const score =
      optedOut || scoreRaw === null
        ? null
        : typeof scoreRaw === "number"
          ? scoreRaw
          : DEFAULT_SCORE;
    return { score, optedOut };
  }
  return null;
}

function findTeamIndex(
  teams: Team[],
  teamId: Id<"teams"> | null | undefined,
): number {
  if (!teamId) return -1;
  return teams.findIndex((team) => team._id === teamId);
}

function initialIndexFor(
  teams: Team[],
  initialTeamId?: Id<"teams"> | null,
): number {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const idx = findTeamIndex(sorted, initialTeamId);
  return idx >= 0 ? idx : 0;
}

export function ScoringWizard({
  eventId,
  teams,
  categories,
  existingScores,
  storageKey,
  onClose,
  onSubmitted,
  initialTeamId,
}: ScoringWizardProps) {
  const submitBatchScores = useMutation(api.scores.submitBatchScores);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  const [draftScores, setDraftScores] = useState<
    Record<string, Record<string, CategoryScoreValue>>
  >({});
  const [completedTeams, setCompletedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [skippedTeams, setSkippedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [currentTeamIndex, setCurrentTeamIndex] = useState(() =>
    initialIndexFor(teams, initialTeamId),
  );
  const [isReviewing, setIsReviewing] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hadStoredDraft, setHadStoredDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [navHistory, setNavHistory] = useState<number[]>([]);
  const [focusedCriterionIndex, setFocusedCriterionIndex] = useState(0);

  const criterionRefs = useRef<Array<HTMLFieldSetElement | null>>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const initialAppliedRef = useRef(false);
  const focusedCriterionIndexRef = useRef(0);
  focusedCriterionIndexRef.current = focusedCriterionIndex;

  const totalTeams = sortedTeams.length;
  const rubricPercentByCategory = useMemo(
    () =>
      new Map(
        getRubricPercentages(categories).map((category) => [
          category.name,
          category.percent,
        ]),
      ),
    [categories],
  );
  const completedCount = completedTeams.size;
  const hasTeams = totalTeams > 0;
  const currentTeam =
    hasTeams && currentTeamIndex >= 0 && currentTeamIndex < totalTeams
      ? sortedTeams[currentTeamIndex]
      : null;
  const currentTeamId = currentTeam?._id as string | undefined;
  const anyOptOut = categories.some((category) => category.optOutAllowed);

  const filledScoresForTeam = useCallback(
    (teamId: string) => {
      const existing = draftScores[teamId] || {};
      const filled: Record<string, CategoryScoreValue> = {};
      categories.forEach(({ name }) => {
        const current = existing[name];
        if (current) {
          filled[name] = {
            score: current.optedOut ? null : (current.score ?? DEFAULT_SCORE),
            optedOut: current.optedOut ?? current.score === null,
          };
          return;
        }
        filled[name] = { score: DEFAULT_SCORE, optedOut: false };
      });
      return filled;
    },
    [categories, draftScores],
  );

  useEffect(() => {
    if (!draftLoaded || !existingScores || existingScores.length === 0) return;

    setDraftScores((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, Record<string, CategoryScoreValue>> = {};
      existingScores.forEach((score) => {
        const key = score.teamId as string;
        next[key] = score.categoryScores.reduce<
          Record<string, CategoryScoreValue>
        >((acc, cs) => {
          acc[cs.category] = {
            score: cs.optedOut ? null : (cs.score ?? DEFAULT_SCORE),
            optedOut: cs.optedOut ?? cs.score === null,
          };
          return acc;
        }, {});
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
        const normalizedScores: Record<
          string,
          Record<string, CategoryScoreValue>
        > = {};
        Object.entries(parsed.scores ?? {}).forEach(([teamId, categoryMap]) => {
          const normalizedCategories: Record<string, CategoryScoreValue> = {};
          Object.entries(categoryMap ?? {}).forEach(
            ([categoryName, value]) => {
              const normalized = normalizeCategoryValue(value);
              if (normalized) {
                normalizedCategories[categoryName] = normalized;
              }
            },
          );
          normalizedScores[teamId] = normalizedCategories;
        });
        setDraftScores(normalizedScores);
        setCompletedTeams(new Set(parsed.completed ?? []));
        setSkippedTeams(new Set(parsed.skipped ?? []));
        setHadStoredDraft(true);
        if (typeof parsed.timestamp === "number") {
          setDraftSavedAt(parsed.timestamp);
        }
        if (
          parsed.currentIndex >= 0 &&
          parsed.currentIndex < sortedTeams.length
        ) {
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
    if (initialAppliedRef.current) return;
    if (storageKey && !draftLoaded) return;

    if (hadStoredDraft) {
      initialAppliedRef.current = true;
      return;
    }

    if (!initialTeamId || sortedTeams.length === 0) {
      initialAppliedRef.current = true;
      return;
    }

    const idx = findTeamIndex(sortedTeams, initialTeamId);
    if (idx >= 0) {
      setCurrentTeamIndex(idx);
    }
    initialAppliedRef.current = true;
  }, [storageKey, draftLoaded, hadStoredDraft, initialTeamId, sortedTeams]);

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
      setDraftSavedAt(payload.timestamp);
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
    [currentTeamId],
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
    [currentTeamId],
  );

  const computeNextIndex = useCallback(
    (completedSet: Set<string>, skippedSet: Set<string>) => {
      const firstIncomplete = sortedTeams.findIndex(
        (t) =>
          !completedSet.has(t._id as string) &&
          !skippedSet.has(t._id as string),
      );
      if (firstIncomplete !== -1) return firstIncomplete;
      const firstSkipped = sortedTeams.findIndex((t) =>
        skippedSet.has(t._id as string),
      );
      if (firstSkipped !== -1) return firstSkipped;
      return -1;
    },
    [sortedTeams],
  );

  const handleAdvance = useCallback(() => {
    if (!currentTeam || !currentTeamId) return;
    setNavHistory((prev) => [...prev, currentTeamIndex]);

    const nextCompleted = new Set(completedTeams);
    nextCompleted.add(currentTeamId);
    const nextSkipped = new Set(skippedTeams);
    nextSkipped.delete(currentTeamId);

    setDraftScores((prev) => ({
      ...prev,
      [currentTeamId]: filledScoresForTeam(currentTeamId),
    }));
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
  }, [
    completedTeams,
    computeNextIndex,
    currentTeamId,
    currentTeamIndex,
    skippedTeams,
  ]);

  useEffect(() => {
    if (!hasTeams) return;
    const id = currentTeamId;
    const isPending = id && !completedTeams.has(id) && !skippedTeams.has(id);
    if (isPending) return;
    const nextIdx = computeNextIndex(completedTeams, skippedTeams);
    if (nextIdx === -1) setIsReviewing(true);
    else setCurrentTeamIndex(nextIdx);
  }, [hasTeams, currentTeamId, completedTeams, skippedTeams, computeNextIndex]);

  const handleGoToTeam = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalTeams) return;
      setNavHistory((prev) =>
        currentTeamIndex >= 0 ? [...prev, currentTeamIndex] : prev,
      );
      setCurrentTeamIndex(index);
      setIsReviewing(false);
    },
    [currentTeamIndex, totalTeams],
  );

  const handleSubmitAll = useCallback(async () => {
    if (completedCount === 0) {
      toast.error("Score at least one team before submitting.");
      return;
    }

    const incompleteCount = totalTeams - completedCount;
    if (incompleteCount > 0) {
      const confirmed = window.confirm(
        `You have ${incompleteCount} incomplete team${incompleteCount === 1 ? "" : "s"}. These teams will not be scored. Submit anyway?`,
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
                  : (entry?.score ?? DEFAULT_SCORE);
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
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to submit scores";
      toast.error(message);
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
    [sortedTeams, completedTeams, skippedTeams, filledScoresForTeam],
  );

  useEffect(() => {
    setFocusedCriterionIndex(0);
  }, [currentTeamId]);

  const focusCriterion = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(categories.length - 1, index));
      setFocusedCriterionIndex(clamped);
      const node = criterionRefs.current[clamped];
      const firstKey = node?.querySelector<HTMLButtonElement>(".fi-wiz-score-key");
      firstKey?.focus();
    },
    [categories.length],
  );

  useEffect(() => {
    if (isReviewing || !hasTeams) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      if (isTypingTarget(event.target)) return;

      const category = categories[focusedCriterionIndexRef.current];
      if (!category) return;

      if (event.key >= "1" && event.key <= "5") {
        event.preventDefault();
        handleScoreSelect(category.name, Number(event.key));
        const nextIndex = focusedCriterionIndexRef.current + 1;
        if (nextIndex < categories.length) {
          focusCriterion(nextIndex);
        } else {
          nextButtonRef.current?.focus();
        }
        return;
      }

      if (event.key === "0" || event.key === "Escape") {
        if (!category.optOutAllowed) return;
        event.preventDefault();
        handleOptOut(category.name);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusCriterion(focusedCriterionIndexRef.current + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusCriterion(focusedCriterionIndexRef.current - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    categories,
    focusCriterion,
    handleOptOut,
    handleScoreSelect,
    hasTeams,
    isReviewing,
  ]);

  const focusedCategory = categories[focusedCriterionIndex];
  const focusedSelection = currentTeamId
    ? draftScores[currentTeamId]?.[focusedCategory?.name ?? ""]
    : undefined;
  const focusedSelectValue = focusedCategory
    ? focusedSelection?.optedOut || focusedSelection?.score === null
      ? "N/A"
      : String(focusedSelection?.score ?? DEFAULT_SCORE)
    : "—";

  const sessionReadout = `${pad2(completedCount)} of ${pad2(totalTeams)} scored`;

  if (!hasTeams) {
    return (
      <div className="fi-wiz" role="dialog" aria-labelledby="fi-wiz-idle-h">
        <header className="fi-wiz-rail fi-wiz-rail--head">
          <div className="fi-wiz-session">
            <div className="fi-wiz-session-line">
              <span className="fi-engraved">Session</span>
              <span className="fi-readout">00 of 00 scored</span>
            </div>
            <div className="fi-wiz-idle-steps" aria-hidden="true">
              <span className="fi-wiz-idle-step" />
              <span className="fi-wiz-idle-step" />
              <span className="fi-wiz-idle-step" />
              <span className="fi-wiz-idle-step" />
            </div>
          </div>
          <div className="fi-wiz-rail-actions">
            <button type="button" onClick={onClose} className="fi-key">
              Exit
            </button>
          </div>
        </header>
        <div className="fi-wiz-body">
          <div className="fi-wiz-idle-wrap">
            <div className="fi-panel fi-wiz-idle">
              <div className="fi-wiz-idle-steps" aria-hidden="true">
                <span className="fi-wiz-idle-step" />
                <span className="fi-wiz-idle-step" />
                <span className="fi-wiz-idle-step" />
                <span className="fi-wiz-idle-step" />
                <span className="fi-wiz-idle-step" />
                <span className="fi-wiz-idle-step" />
                <span className="fi-wiz-idle-step" />
                <span className="fi-wiz-idle-step" />
              </div>
              <p className="fi-engraved fi-wiz-idle-copy" id="fi-wiz-idle-h">
                No teams queued · Nothing to score
              </p>
              <p className="fi-wiz-idle-body">
                There are currently no teams to score for this event.
              </p>
              <button type="button" onClick={onClose} className="fi-key">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fi-wiz" role="dialog" aria-labelledby="fi-wiz-team-name">
      <header className="fi-wiz-rail fi-wiz-rail--head">
        <div className="fi-wiz-session">
          <div className="fi-wiz-session-line">
            <span className="fi-engraved">Session</span>
            <span className="fi-readout">{sessionReadout}</span>
            {storageKey && draftSavedAt !== null && (
              <span className="fi-readout fi-wiz-draft" aria-live="polite">
                Draft · saved {formatDraftTime(draftSavedAt)}
              </span>
            )}
          </div>
          <div
            className="fi-wiz-steps"
            role="img"
            aria-label={`Team progress: ${completedCount} of ${totalTeams} scored`}
          >
            {sortedTeams.map((team, index) => {
              const id = team._id as string;
              const isDone = completedTeams.has(id);
              const isSkipped = skippedTeams.has(id);
              const isCurrent = !isReviewing && index === currentTeamIndex;
              return (
                <span
                  key={id}
                  className={clsx(
                    "fi-wiz-step",
                    isDone && "is-done",
                    isSkipped && "is-skipped",
                    isCurrent && "is-current",
                  )}
                />
              );
            })}
          </div>
        </div>
        <div className="fi-wiz-rail-actions">
          {isReviewing ? (
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              className="fi-key"
            >
              Back to scoring
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsReviewing(true)}
              className="fi-key"
            >
              Take sheet
            </button>
          )}
          <button type="button" onClick={onClose} className="fi-key">
            Exit
          </button>
        </div>
      </header>

      <div className="fi-wiz-body">
        {isReviewing ? (
          <ReviewPanel
            entries={summaryEntries}
            rubricPercentByCategory={rubricPercentByCategory}
            onEdit={handleGoToTeam}
            skippedCount={skippedTeams.size}
            completedCount={completedCount}
            totalTeams={totalTeams}
          />
        ) : (
          currentTeam && (
            <div className="fi-wiz-stage">
              <section className="fi-module fi-wiz-module">
                <div className="fi-wiz-module-top">
                  <div
                    className="fi-wiz-crit-steps"
                    role="img"
                    aria-label={`Criterion progress for ${currentTeam.name}`}
                  >
                    {categories.map((category, index) => {
                      const explicit =
                        currentTeamId !== undefined &&
                        Boolean(draftScores[currentTeamId]?.[category.name]);
                      const isCurrent = index === focusedCriterionIndex;
                      return (
                        <span
                          key={category.name}
                          className={clsx(
                            "fi-wiz-crit-step",
                            explicit && "is-done",
                            isCurrent && "is-current",
                          )}
                        />
                      );
                    })}
                  </div>
                  <div className="fi-wiz-chips">
                    <span className="fi-wiz-chip">
                      Team {pad2(currentTeamIndex + 1)} / {pad2(totalTeams)}
                    </span>
                    {currentTeam.track ? (
                      <span className="fi-wiz-chip">{currentTeam.track}</span>
                    ) : null}
                    {currentTeam.members.length > 0 ? (
                      <span className="fi-wiz-chip">
                        {pad2(currentTeam.members.length)} members
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="fi-wiz-screen-tile">
                  <h2 className="fi-wiz-team-name" id="fi-wiz-team-name">
                    {currentTeam.name}
                  </h2>
                </div>
                <p className="fi-wiz-select" aria-live="polite">
                  Select · {focusedCategory?.name ?? "—"} ·{" "}
                  <b>{focusedSelectValue}</b>
                </p>
              </section>

              <div className="fi-wiz-criteria">
                {categories.map(({ name, optOutAllowed }, index) => {
                  const teamId = currentTeam._id as string;
                  const selection = draftScores[teamId]?.[name];
                  const isOptedOut = Boolean(selection?.optedOut);
                  const selected =
                    isOptedOut || selection?.score === null
                      ? null
                      : (selection?.score ?? DEFAULT_SCORE);
                  const isFocused = index === focusedCriterionIndex;
                  return (
                    <fieldset
                      key={name}
                      ref={(node) => {
                        criterionRefs.current[index] = node;
                      }}
                      tabIndex={-1}
                      className={clsx(
                        "fi-wiz-criterion",
                        isFocused && "is-focused",
                      )}
                      onFocusCapture={() => setFocusedCriterionIndex(index)}
                    >
                      <legend className="fi-wiz-criterion-legend">
                        <span className="fi-wiz-criterion-name">{name}</span>
                        <span className="fi-readout">
                          {formatRubricPercent(
                            rubricPercentByCategory.get(name) ?? 0,
                          )}{" "}
                          of rubric
                        </span>
                      </legend>
                      <div className="fi-wiz-score-keys">
                        {SCORE_VALUES.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleScoreSelect(name, value)}
                            className={clsx(
                              "fi-wiz-score-key",
                              selected === value && !isOptedOut && "is-selected",
                              isOptedOut && "is-dim",
                            )}
                            aria-pressed={selected === value && !isOptedOut}
                            aria-label={`Score ${value} for ${name}`}
                          >
                            <span className="fi-wiz-score-led" aria-hidden="true" />
                            {value}
                          </button>
                        ))}
                      </div>
                      {optOutAllowed && (
                        <div className="fi-wiz-optout">
                          <button
                            type="button"
                            onClick={() => handleOptOut(name)}
                            className={clsx("fi-key", isOptedOut && "is-latched")}
                            aria-pressed={isOptedOut}
                          >
                            {isOptedOut
                              ? "Marked N/A"
                              : "Not comfortable judging this"}
                          </button>
                          <p className="fi-wiz-optout-note">
                            Marks this category as neutral and skips scoring it.
                          </p>
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </div>

              <p className="fi-engraved fi-wiz-hint">
                Keys 1–5
                {anyOptOut ? " · 0 = N/A" : ""}
                {" · ↑↓ criterion"}
              </p>
            </div>
          )
        )}
      </div>

      {isReviewing ? (
        <footer className="fi-wiz-rail fi-wiz-rail--foot">
          <div className="fi-wiz-nav">
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              className="fi-key"
            >
              Back to scoring
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSubmitAll();
              }}
              className="fi-transport"
              disabled={submitting || completedCount === 0}
            >
              {submitting ? "Submitting…" : "Submit scores"}
            </button>
          </div>
        </footer>
      ) : (
        <footer className="fi-wiz-rail fi-wiz-rail--foot">
          <div className="fi-wiz-nav">
            <button
              type="button"
              onClick={handlePrevious}
              className="fi-key"
              disabled={navHistory.length === 0}
            >
              Previous
            </button>
            <button type="button" onClick={handleSkip} className="fi-key">
              Skip
            </button>
            <button
              type="button"
              ref={nextButtonRef}
              onClick={handleAdvance}
              className="fi-key"
            >
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
  onEdit,
  rubricPercentByCategory,
  skippedCount,
  completedCount,
  totalTeams,
}: {
  entries: ReviewEntry[];
  rubricPercentByCategory: Map<string, number>;
  onEdit: (index: number) => void;
  skippedCount: number;
  completedCount: number;
  totalTeams: number;
}) {
  return (
    <div className="fi-wiz-sheet">
      <div className="fi-wiz-sheet-head">
        <h2 className="fi-zone">Take sheet</h2>
        <span className="fi-engraved">
          {pad2(completedCount)} of {pad2(totalTeams)} scored
          {skippedCount > 0 ? ` · ${pad2(skippedCount)} skipped` : ""}
        </span>
      </div>

      <div className="fi-wiz-ledger">
        {entries.map(({ team, index, status, scores }) => (
          <div key={team._id} className="fi-wiz-row">
            <h3 className="fi-wiz-row-name">{team.name}</h3>
            <span
              className={clsx(
                "fi-wiz-stamp",
                status === "completed" && "is-done",
                status === "skipped" && "is-skipped",
              )}
            >
              {STAMP_LABEL[status]}
            </span>
            <div className="fi-wiz-readouts">
              {status !== "pending" ? (
                Object.entries(scores).map(([category, scoreValue]) => {
                  const isOptedOut = Boolean(scoreValue.optedOut);
                  const displayScore =
                    isOptedOut || scoreValue.score === null
                      ? "N/A"
                      : String(scoreValue.score);
                  return (
                    <span
                      key={category}
                      className={clsx(
                        "fi-wiz-readout-item",
                        isOptedOut && "is-na",
                      )}
                    >
                      <span className="fi-engraved-sm">
                        {category}{" "}
                        {formatRubricPercent(
                          rubricPercentByCategory.get(category) ?? 0,
                        )}
                      </span>
                      <span className="fi-readout">{displayScore}</span>
                    </span>
                  );
                })
              ) : (
                <p className="fi-wiz-open-copy">Not scored</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEdit(index)}
              className="fi-key fi-key--sm"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
