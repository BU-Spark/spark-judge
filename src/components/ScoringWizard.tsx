import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import clsx from "clsx";
import type { FunctionArgs } from "convex/server";
import { DirectionIcon } from "./participation/ParticipationChrome";
import {
  formatRubricPercent,
  getRubricPercentages,
} from "../lib/scoringWeights";
import {
  quarantineDraft,
  readDraft,
  removeDraft,
  safeGetItem,
  writeDraft,
} from "../lib/draftStorage";
import { pad2 } from "../lib/dateTimeInput";
import {
  SCORING_DRAFT_SCHEMA,
  isRecord,
  draftAfterSubmit,
  isScoringDraft,
  parseLegacyDraft,
  scoringDraftKey,
  type ScoringDraft,
} from "../lib/scoringDraft";
import {
  outcomeForFailure,
  reportFailure,
  toRecoverableFailure,
  type RecoverableFailure,
} from "../lib/operationOutcome";
import { InlineFailure, TaskStatus, type TaskSaveState } from "./ui/TaskStatus";
import "./ScoringWizard.fi.css";
import { ExpandableProjectMarkdown } from "./ui/ExpandableProjectMarkdown";

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
  eventName?: string;
  embedded?: boolean;
  teams: Team[];
  /** Full event roster, so changing the queue never discards other draft scores. */
  rosterTeamIds?: Id<"teams">[];
  categories: Category[];
  existingScores?: ExistingScore[];
  storageKey: string | null;
  onClose: () => void;
  onSubmitted: () => void;
  /**
   * Opens the wizard on this team when found in the sorted list.
   * An explicit team choice takes precedence over a saved draft's position.
   * Without a valid choice, resume the draft position as usual.
   */
  initialTeamId?: Id<"teams"> | null;
};

/** How long to wait for live server scores before offering resubmission. */
const RECONCILE_WINDOW_MS = 5000;

type SubmitEntry = {
  teamId: Id<"teams">;
  categoryScores: {
    category: string;
    score: number | null;
    optedOut: boolean;
  }[];
};

/** True when every submitted team/category is reflected in the server's scores. */
function serverHasSnapshot(
  snapshot: SubmitEntry[],
  serverScores: ExistingScore[],
): boolean {
  if (snapshot.length === 0) return false;
  return snapshot.every((entry) => {
    const server = serverScores.find((score) => score.teamId === entry.teamId);
    if (!server) return false;
    return entry.categoryScores.every((submitted) => {
      const match = server.categoryScores.find(
        (cs) => cs.category === submitted.category,
      );
      if (!match) return false;
      return (
        Boolean(match.optedOut) === submitted.optedOut &&
        (submitted.optedOut || match.score === submitted.score)
      );
    });
  });
}

type SubmitFailureState = {
  failure: RecoverableFailure;
  outcome: "rejected" | "unknown";
  snapshot: SubmitEntry[];
  /** Unknown outcomes: true while we wait for live server scores. */
  checking: boolean;
};

const SCORE_VALUES = [1, 2, 3, 4, 5] as const;

type ReviewStatus = "completed" | "skipped" | "incomplete" | "pending";

const STAMP_LABEL: Record<ReviewStatus, string> = {
  completed: "Done",
  skipped: "Skipped",
  incomplete: "Incomplete",
  pending: "Open",
};

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    (SCORE_VALUES as readonly number[]).includes(value)
  );
}

/**
 * A category counts as answered only when the judge picked a 1–5 score, or
 * marked it N/A on a category that allows opting out. There is no default.
 */
function isCategoryAnswered(
  value: CategoryScoreValue | undefined,
  category: Category,
): boolean {
  if (!value) return false;
  if (value.optedOut) return Boolean(category.optOutAllowed);
  return isValidScore(value.score);
}

function countUnanswered(
  teamScores: Record<string, CategoryScoreValue> | undefined,
  categories: Category[],
): number {
  return categories.reduce(
    (count, category) =>
      isCategoryAnswered(teamScores?.[category.name], category)
        ? count
        : count + 1,
    0,
  );
}

function isTeamFullyAnswered(
  teamScores: Record<string, CategoryScoreValue> | undefined,
  categories: Category[],
): boolean {
  return countUnanswered(teamScores, categories) === 0;
}

function formatDraftTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function normalizeCategoryValue(value: unknown): CategoryScoreValue | null {
  if (isValidScore(value)) {
    return { score: value, optedOut: false };
  }
  if (isRecord(value)) {
    if (value.optedOut === true) return { score: null, optedOut: true };
    if (isValidScore(value.score)) {
      return { score: value.score, optedOut: false };
    }
  }
  // Anything else (missing score, null without an explicit opt-out, junk)
  // is treated as unanswered rather than silently defaulted.
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

export function ScoringWizard(props: ScoringWizardProps) {
  const submitBatchScores = useMutation(api.scores.submitBatchScores);
  return <ScoringSession {...props} submitBatchScores={submitBatchScores} />;
}

export function ScoringSession({
  eventId,
  eventName = "Hackathon judging",
  teams,
  rosterTeamIds,
  categories,
  existingScores,
  storageKey,
  onClose,
  onSubmitted,
  initialTeamId,
  submitBatchScores,
  embedded = false,
}: ScoringWizardProps & {
  submitBatchScores: (
    args: FunctionArgs<typeof api.scores.submitBatchScores>,
  ) => Promise<unknown>;
}) {
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
  const [browsingTeam, setBrowsingTeam] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [localState, setLocalState] = useState<
    "clean" | "local" | "local-unavailable"
  >("clean");
  const [draftNotices, setDraftNotices] = useState<string[]>([]);
  const [submitFailure, setSubmitFailure] = useState<SubmitFailureState | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const draftStorageKey = storageKey ? scoringDraftKey(storageKey) : null;
  const [navHistory, setNavHistory] = useState<number[]>([]);
  const [focusedCriterionIndex, setFocusedCriterionIndex] = useState(0);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (embedded) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onDialogKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onDialogKey);
      previousFocus?.focus();
    };
  }, [embedded]);

  const draftScoresRef = useRef(draftScores);
  draftScoresRef.current = draftScores;
  const focusNextPendingRef = useRef(false);
  const currentTeamScoresRef = useRef<
    Record<string, CategoryScoreValue> | undefined
  >(undefined);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
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
  // Only teams that are fully answered count as completed. A team marked
  // completed under an older draft (or before a category was added) that is
  // missing answers is shown as incomplete and never submitted.
  const effectiveCompleted = useMemo(() => {
    const next = new Set<string>();
    const sessionTeamIds = new Set(sortedTeams.map((team) => String(team._id)));
    completedTeams.forEach((id) => {
      if (
        sessionTeamIds.has(id) &&
        isTeamFullyAnswered(draftScores[id], categories)
      )
        next.add(id);
    });
    return next;
  }, [categories, completedTeams, draftScores, sortedTeams]);
  const completedCount = effectiveCompleted.size;
  const hasTeams = totalTeams > 0;
  const currentTeam =
    hasTeams && currentTeamIndex >= 0 && currentTeamIndex < totalTeams
      ? sortedTeams[currentTeamIndex]
      : null;
  const currentTeamId = currentTeam?._id as string | undefined;
  const anyOptOut = categories.some((category) => category.optOutAllowed);

  const currentUnansweredCount = currentTeamId
    ? countUnanswered(draftScores[currentTeamId], categories)
    : categories.length;
  const canAdvance = Boolean(currentTeamId) && currentUnansweredCount === 0;
  currentTeamScoresRef.current = currentTeamId
    ? draftScores[currentTeamId]
    : undefined;

  const answeredScoresForTeam = useCallback(
    (teamId: string) => {
      const existing = draftScores[teamId] || {};
      const answered: Record<string, CategoryScoreValue> = {};
      categories.forEach((category) => {
        const current = existing[category.name];
        if (current && isCategoryAnswered(current, category)) {
          answered[category.name] = current.optedOut
            ? { score: null, optedOut: true }
            : { score: current.score, optedOut: false };
        }
      });
      return answered;
    },
    [categories, draftScores],
  );

  useEffect(() => {
    if (!draftLoaded || !existingScores || existingScores.length === 0) return;

    const seeded: Record<string, Record<string, CategoryScoreValue>> = {};
    existingScores.forEach((score) => {
      seeded[score.teamId as string] = score.categoryScores.reduce<
        Record<string, CategoryScoreValue>
      >((acc, cs) => {
        const normalized = normalizeCategoryValue(cs);
        if (normalized) acc[cs.category] = normalized;
        return acc;
      }, {});
    });
    // Draft entries win per team. Teams the draft doesn't mention (e.g. ones
    // submitted earlier while partial work for others was kept) show their
    // server scores.
    const draftTeams = new Set(Object.keys(draftScoresRef.current));
    const unseen = Object.keys(seeded).filter((id) => !draftTeams.has(id));
    if (unseen.length === 0) return;
    setDraftScores((prev) => {
      const next = { ...prev };
      unseen.forEach((id) => {
        if (!(id in next)) next[id] = seeded[id];
      });
      return next;
    });
    setCompletedTeams((prev) => {
      const next = new Set(prev);
      unseen.forEach((id) => {
        if (isTeamFullyAnswered(seeded[id], categoriesRef.current))
          next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [existingScores, draftLoaded]);

  useEffect(() => {
    if (draftLoaded) return;
    if (!storageKey || !draftStorageKey) {
      setDraftLoaded(true);
      return;
    }
    if (typeof window === "undefined") return;

    const notices: string[] = [];
    let draft: ScoringDraft | null = null;
    let legacyIndex: number | null = null;
    let savedAt: number | null = null;

    const result = readDraft<ScoringDraft>(
      draftStorageKey,
      SCORING_DRAFT_SCHEMA,
      { isValid: isScoringDraft },
    );
    if (result.status === "found") {
      if (result.data.submittedAt) {
        // These scores were accepted but cleanup failed; never restore them.
        removeDraft(draftStorageKey);
      } else {
        draft = result.data;
        savedAt = result.savedAt;
      }
    } else if (result.status === "unreadable") {
      quarantineDraft(draftStorageKey, result.raw);
      notices.push(
        "A saved draft on this device couldn't be read, so it was set aside. Scores already submitted to HackJudge are unaffected.",
      );
    } else if (result.status === "unavailable") {
      setLocalState("local-unavailable");
    }

    if (!draft && result.status !== "unavailable") {
      // One-time migration from the unversioned draft kept at `storageKey`.
      const legacyRaw = safeGetItem(storageKey);
      const legacy = parseLegacyDraft(legacyRaw);
      if (legacy) {
        draft = legacy;
        legacyIndex = legacy.currentIndex;
        savedAt = legacy.savedAt;
        removeDraft(storageKey);
      } else if (legacyRaw !== null) {
        quarantineDraft(storageKey, legacyRaw);
        notices.push(
          "A saved draft on this device couldn't be read, so it was set aside. Scores already submitted to HackJudge are unaffected.",
        );
      }
    }

    if (draft) {
      const teamIds = new Set<string>(
        rosterTeamIds ?? sortedTeams.map((team) => team._id),
      );
      const categoryNames = new Set(categories.map((c) => c.name));
      // Only prune when the roster and rubric are actually loaded.
      const canPrune = teamIds.size > 0 && categoryNames.size > 0;
      let dropped = 0;
      const normalizedScores: Record<
        string,
        Record<string, CategoryScoreValue>
      > = {};
      Object.entries(draft.scores).forEach(([teamId, categoryMap]) => {
        const normalizedCategories: Record<string, CategoryScoreValue> = {};
        Object.entries(categoryMap ?? {}).forEach(([categoryName, value]) => {
          const normalized = normalizeCategoryValue(value);
          if (!normalized) return;
          if (
            canPrune &&
            (!teamIds.has(teamId) || !categoryNames.has(categoryName))
          ) {
            dropped += 1;
            return;
          }
          normalizedCategories[categoryName] = normalized;
        });
        if (canPrune && !teamIds.has(teamId)) return;
        normalizedScores[teamId] = normalizedCategories;
      });
      const keepTeam = (id: string) => !canPrune || teamIds.has(id);
      setDraftScores(normalizedScores);
      // Older drafts could mark a team completed while relying on the
      // implicit default; drop those so the judge finishes them explicitly.
      setCompletedTeams(
        new Set(
          draft.completed.filter(
            (id) =>
              keepTeam(id) &&
              isTeamFullyAnswered(normalizedScores[id], categoriesRef.current),
          ),
        ),
      );
      setSkippedTeams(new Set(draft.skipped.filter(keepTeam)));
      if (savedAt !== null) setDraftSavedAt(savedAt);
      const restoredIndex = findTeamIndex(
        sortedTeams,
        draft.currentTeamId as Id<"teams"> | null,
      );
      if (restoredIndex >= 0) {
        setCurrentTeamIndex(restoredIndex);
      } else if (
        legacyIndex !== null &&
        legacyIndex >= 0 &&
        legacyIndex < sortedTeams.length
      ) {
        setCurrentTeamIndex(legacyIndex);
      }
      if (dropped > 0) {
        notices.push(
          `${dropped} saved score${dropped === 1 ? " was" : "s were"} removed from your draft because the project or category is no longer part of this event.`,
        );
      }
    }

    if (notices.length > 0) setDraftNotices(notices);
    setDraftLoaded(true);
    // Restores once per mount; later roster changes must not reload the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, draftStorageKey, draftLoaded]);

  useEffect(() => {
    if (initialAppliedRef.current) return;
    if (storageKey && !draftLoaded) return;

    if (!initialTeamId || sortedTeams.length === 0) {
      initialAppliedRef.current = true;
      return;
    }

    const idx = findTeamIndex(sortedTeams, initialTeamId);
    if (idx >= 0) {
      setCurrentTeamIndex(idx);
    }
    initialAppliedRef.current = true;
  }, [storageKey, draftLoaded, initialTeamId, sortedTeams]);

  useEffect(() => {
    if (!draftLoaded || !draftStorageKey) return;
    if (typeof window === "undefined") return;
    // Once the server accepted the batch, never write the draft back.
    if (submittedRef.current) return;

    const payload: ScoringDraft = {
      scores: draftScores,
      completed: Array.from(completedTeams),
      skipped: Array.from(skippedTeams),
      currentTeamId: (sortedTeams[currentTeamIndex]?._id as string) ?? null,
    };

    const result = writeDraft(draftStorageKey, SCORING_DRAFT_SCHEMA, payload);
    if (result.status === "saved") {
      setDraftSavedAt(result.savedAt);
      setLocalState("local");
    } else {
      setLocalState("local-unavailable");
    }
  }, [
    draftScores,
    completedTeams,
    skippedTeams,
    currentTeamIndex,
    sortedTeams,
    draftStorageKey,
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
        if (current?.optedOut) {
          // Un-marking N/A leaves the category unanswered again.
          delete existing[category];
        } else {
          existing[category] = { score: null, optedOut: true };
        }
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
    if (!isTeamFullyAnswered(draftScores[currentTeamId], categories)) return;
    setNavHistory((prev) => [...prev, currentTeamIndex]);

    const nextCompleted = new Set(completedTeams);
    nextCompleted.add(currentTeamId);
    const nextSkipped = new Set(skippedTeams);
    nextSkipped.delete(currentTeamId);

    setCompletedTeams(nextCompleted);
    setSkippedTeams(nextSkipped);

    const nextIdx = computeNextIndex(nextCompleted, nextSkipped);
    if (nextIdx === -1) setIsReviewing(true);
    else setCurrentTeamIndex(nextIdx);
  }, [
    categories,
    completedTeams,
    computeNextIndex,
    currentTeam,
    currentTeamId,
    currentTeamIndex,
    draftScores,
    skippedTeams,
  ]);

  const handlePrevious = useCallback(() => {
    setBrowsingTeam(true);
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
    if (!hasTeams || browsingTeam) return;
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
    browsingTeam,
  ]);

  const handleGoToTeam = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalTeams) return;
      setNavHistory((prev) =>
        currentTeamIndex >= 0 ? [...prev, currentTeamIndex] : prev,
      );
      setBrowsingTeam(true);
      setCurrentTeamIndex(index);
      setIsReviewing(false);
    },
    [currentTeamIndex, totalTeams],
  );

  const buildPayload = useCallback((): SubmitEntry[] => {
    // effectiveCompleted only holds fully answered teams, so every
    // category below has a real 1–5 score or an explicit N/A.
    return sortedTeams
      .filter((team) => effectiveCompleted.has(team._id as string))
      .map((team) => {
        const teamId = team._id as string;
        const scores = answeredScoresForTeam(teamId);
        return {
          teamId: team._id,
          categoryScores: categories.map(({ name }) => {
            const entry = scores[name];
            const optedOut = entry.optedOut === true;
            return {
              category: name,
              score: optedOut ? null : entry.score,
              optedOut,
            };
          }),
        };
      });
  }, [answeredScoresForTeam, categories, effectiveCompleted, sortedTeams]);

  /**
   * Runs only after the server accepted the batch. Local cleanup and the
   * caller's callback are separate steps: neither can turn a confirmed
   * submission into a reported failure.
   */
  const finishSubmitted = useCallback(
    (submitted: SubmitEntry[]) => {
      submittedRef.current = true;
      setSubmitFailure(null);

      const submittedCount = submitted.length;
      let keptCount = 0;
      let lostCount = 0;
      let cleanupFailed = false;
      if (draftStorageKey) {
        // Keep the judge's unsubmitted partial work; drop only what was sent.
        const remaining = draftAfterSubmit(
          {
            scores: draftScores,
            completed: Array.from(completedTeams),
            skipped: Array.from(skippedTeams),
            currentTeamId: null,
          },
          submitted.map((entry) => entry.teamId as string),
          sortedTeams.map((team) => team._id as string),
        );
        if (remaining) {
          const kept = writeDraft(
            draftStorageKey,
            SCORING_DRAFT_SCHEMA,
            remaining,
          );
          const remainingCount = Object.keys(remaining.scores).length;
          if (kept.status === "saved") keptCount = remainingCount;
          else lostCount = remainingCount;
        }
        if (
          keptCount === 0 &&
          removeDraft(draftStorageKey).status !== "removed"
        ) {
          // Removal failed: mark the draft as submitted so it is never restored.
          const marker = writeDraft<ScoringDraft>(
            draftStorageKey,
            SCORING_DRAFT_SCHEMA,
            {
              scores: {},
              completed: [],
              skipped: [],
              currentTeamId: null,
              submittedAt: Date.now(),
            },
          );
          cleanupFailed = marker.status !== "saved";
        }
      }

      if (keptCount > 0) {
        toast.success(
          `Scores for ${submittedCount} ${submittedCount === 1 ? "project" : "projects"} saved. Your partial scores for ${keptCount} ${keptCount === 1 ? "project" : "projects"} are kept on this device.`,
        );
      } else {
        toast.success("Scores submitted to HackJudge.");
      }
      if (lostCount > 0) {
        toast.warning(
          `Your submitted scores are saved, but this browser couldn't keep your partial scores for ${lostCount} ${lostCount === 1 ? "project" : "projects"} on this device.`,
        );
      } else if (cleanupFailed) {
        toast.warning(
          "Your scores are saved. This browser couldn't clear its local draft, so an old draft may appear next time; your submitted scores are not affected.",
        );
      }

      try {
        onSubmitted();
      } catch (error) {
        reportFailure("scoring_after_submit", "local", error);
      }
    },
    [
      completedTeams,
      draftScores,
      draftStorageKey,
      onSubmitted,
      skippedTeams,
      sortedTeams,
    ],
  );

  const handleSubmitAll = useCallback(
    async (options: { skipConfirm?: boolean } = {}) => {
      if (submitting) return;
      if (completedCount === 0) {
        toast.error("Score at least one team before submitting.");
        return;
      }

      const incompleteCount = totalTeams - completedCount;
      if (incompleteCount > 0 && !options.skipConfirm) {
        const confirmed = window.confirm(
          `You have ${incompleteCount} incomplete team${incompleteCount === 1 ? "" : "s"}. These teams will not be scored. Submit anyway?`,
        );
        if (!confirmed) return;
      }

      const payload = buildPayload();
      if (payload.length === 0) {
        toast.error("No completed teams to submit.");
        return;
      }

      setSubmitting(true);
      setSubmitFailure(null);
      try {
        await submitBatchScores({ eventId, scores: payload });
      } catch (error: unknown) {
        // Every score stays in memory and in the local draft.
        const failure = toRecoverableFailure(error, "submit_scores");
        const outcome = outcomeForFailure(failure);
        setSubmitFailure({
          failure,
          outcome,
          snapshot: payload,
          checking: outcome === "unknown",
        });
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      finishSubmitted(payload);
    },
    [
      buildPayload,
      completedCount,
      eventId,
      finishSubmitted,
      submitBatchScores,
      submitting,
      totalTeams,
    ],
  );

  // Uncertain outcome: the write may have landed. Reconcile against the live
  // server scores before offering a resubmit.
  const checkingSave = submitFailure?.checking === true;
  useEffect(() => {
    if (!checkingSave) return;
    const timer = window.setTimeout(() => {
      setSubmitFailure((prev) => (prev ? { ...prev, checking: false } : prev));
    }, RECONCILE_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [checkingSave]);

  useEffect(() => {
    if (submitFailure?.outcome !== "unknown" || !existingScores) return;
    if (!serverHasSnapshot(submitFailure.snapshot, existingScores)) return;
    const current = buildPayload();
    if (JSON.stringify(current) === JSON.stringify(submitFailure.snapshot)) {
      finishSubmitted(current);
    } else {
      // The earlier batch landed, but the judge has edited since; keep the
      // newer changes and ask for another submit rather than clearing them.
      setSubmitFailure(null);
      setDraftNotices((prev) => [
        ...prev,
        "Your earlier submission reached HackJudge. You've changed scores since then; submit again to save the latest version.",
      ]);
    }
  }, [buildPayload, existingScores, finishSubmitted, submitFailure]);

  const summaryEntries = useMemo(
    () =>
      sortedTeams.map((team, index) => {
        const id = team._id as string;
        const scores = answeredScoresForTeam(id);
        const hasAnswers = Object.keys(scores).length > 0;
        let status: ReviewStatus = "pending";
        if (effectiveCompleted.has(id)) status = "completed";
        else if (skippedTeams.has(id)) status = "skipped";
        else if (completedTeams.has(id) || hasAnswers) status = "incomplete";
        return {
          team,
          index,
          status,
          scores,
          missing: countUnanswered(draftScores[id], categories),
        };
      }),
    [
      sortedTeams,
      completedTeams,
      effectiveCompleted,
      skippedTeams,
      answeredScoresForTeam,
      draftScores,
      categories,
    ],
  );

  useEffect(() => {
    setFocusedCriterionIndex(0);
    focusNextPendingRef.current = false;
  }, [currentTeamId]);

  useEffect(() => {
    if (!focusNextPendingRef.current || !canAdvance) return;
    focusNextPendingRef.current = false;
    nextButtonRef.current?.focus();
  }, [canAdvance]);

  const focusCriterion = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(categories.length - 1, index));
      setFocusedCriterionIndex(clamped);
      const node = criterionRefs.current[clamped];
      const firstKey =
        node?.querySelector<HTMLButtonElement>(".fi-wiz-score-key");
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
          return;
        }
        // Last criterion: jump back to the first one still unanswered, or
        // hand focus to Next once it enables after this render.
        const teamScores = currentTeamScoresRef.current;
        const firstOpen = categories.findIndex(
          (c) =>
            c.name !== category.name &&
            !isCategoryAnswered(teamScores?.[c.name], c),
        );
        if (firstOpen !== -1) {
          focusCriterion(firstOpen);
        } else {
          focusNextPendingRef.current = true;
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

  const sessionReadout = `${pad2(completedCount)} of ${pad2(totalTeams)} scored`;

  let taskState: TaskSaveState = storageKey ? localState : "clean";
  let taskLabel: string | undefined;
  if (submitting) taskState = "saving";
  else if (submitFailure) taskState = submitFailure.outcome;
  else if (taskState === "local" && draftSavedAt !== null) {
    taskLabel = `Draft saved on this device · ${formatDraftTime(draftSavedAt)}`;
  }

  const keptCount = submitFailure?.snapshot.length ?? 0;
  const keptCopy = `Your scores for ${keptCount} project${keptCount === 1 ? "" : "s"} are kept${
    localState === "local" ? " on this device" : " in this tab"
  }.`;
  const failurePanel = submitFailure ? (
    submitFailure.outcome === "unknown" ? (
      <InlineFailure
        title={
          submitFailure.checking
            ? "Checking whether your scores saved…"
            : "We couldn't confirm your scores saved"
        }
        failure={submitFailure.failure}
        onRetry={
          submitFailure.checking
            ? undefined
            : () => void handleSubmitAll({ skipConfirm: true })
        }
        retryLabel="Submit again"
        busy={submitting}
      >
        <p className="inline-failure-body">
          {submitFailure.checking
            ? "The connection dropped before HackJudge replied. We're comparing your scores with what HackJudge has."
            : "Submitting again is safe: it replaces your earlier scores rather than adding duplicates."}{" "}
          {keptCopy}
        </p>
      </InlineFailure>
    ) : (
      <InlineFailure
        title="Scores not submitted"
        failure={submitFailure.failure}
        onRetry={
          submitFailure.failure.retryable
            ? () => void handleSubmitAll({ skipConfirm: true })
            : undefined
        }
        busy={submitting}
        onDismiss={() => setSubmitFailure(null)}
      >
        <p className="inline-failure-body">{keptCopy}</p>
      </InlineFailure>
    )
  ) : null;

  const noticesPanel =
    draftNotices.length > 0 ? (
      <div className="fi-wiz-notices">
        <InlineFailure
          title="Your draft changed"
          onDismiss={() => setDraftNotices([])}
        >
          {draftNotices.map((notice) => (
            <p key={notice} className="inline-failure-body">
              {notice}
            </p>
          ))}
        </InlineFailure>
      </div>
    ) : null;

  if (!hasTeams) {
    return (
      <div
        className="fi-wiz participation participation--hackathon"
        ref={dialogRef}
        tabIndex={-1}
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-labelledby="fi-wiz-idle-h"
      >
        <header className="fi-wiz-rail fi-wiz-rail--head">
          <div className="fi-wiz-session">
            <div className="fi-wiz-session-line">
              <strong className="scoring-session-name">{eventName}</strong>
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
    <div
      className="fi-wiz participation participation--hackathon"
      ref={dialogRef}
      tabIndex={-1}
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-labelledby={
        isReviewing ? "scoring-review-heading" : "fi-wiz-team-name"
      }
    >
      <header className="fi-wiz-rail fi-wiz-rail--head">
        <div className="fi-wiz-session">
          <div className="fi-wiz-session-line">
            <strong className="scoring-session-name">{eventName}</strong>
            <span className="fi-readout">{sessionReadout}</span>
            <TaskStatus state={taskState} label={taskLabel} />
          </div>
          <div
            className="fi-wiz-steps"
            role="img"
            aria-label={`Team progress: ${completedCount} of ${totalTeams} scored`}
          >
            {sortedTeams.map((team, index) => {
              const id = team._id as string;
              const isDone = effectiveCompleted.has(id);
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
              Review scores
            </button>
          )}
          <button type="button" onClick={onClose} className="fi-key">
            Exit
          </button>
        </div>
      </header>

      {noticesPanel}

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
                <h2 className="fi-wiz-team-name" id="fi-wiz-team-name">
                  {currentTeam.name}
                </h2>
                <div className="scoring-project-position">
                  Project {currentTeamIndex + 1} of {totalTeams}
                  {currentTeam.track ? ` · ${currentTeam.track}` : ""}
                </div>
                <ExpandableProjectMarkdown key={currentTeam._id} className="scoring-project-description">
                  {currentTeam.description ||
                    "No project description provided."}
                </ExpandableProjectMarkdown>
                {currentTeam.members.length > 0 && (
                  <div className="scoring-members scoring-members--desktop">
                    <h3>The team</h3>
                    <p>{currentTeam.members.join(" · ")}</p>
                  </div>
                )}
                <details className="scoring-guidance">
                  <summary>Team & scoring guide</summary>
                  {currentTeam.members.length > 0 && (
                    <div className="scoring-members">
                      <h3>The team</h3>
                      <p>{currentTeam.members.join(" · ")}</p>
                    </div>
                  )}
                  <p>
                    Score every criterion from 1 to 5, then choose Next to add
                    this project to your review. Skip leaves it unscored.
                  </p>
                  <p>
                    Your draft is submitted only when you choose Submit scores.
                  </p>
                </details>
              </section>

              <div className="fi-wiz-criteria">
                <div className="scoring-rubric-title">
                  <h3>Score this project</h3>
                  <span>1–5 scale</span>
                </div>
                {categories.map(({ name, optOutAllowed }, index) => {
                  const teamId = currentTeam._id as string;
                  const selection = draftScores[teamId]?.[name];
                  const isOptedOut = Boolean(selection?.optedOut);
                  const selected =
                    isOptedOut || !isValidScore(selection?.score)
                      ? null
                      : selection.score;
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
                              selected === value &&
                                !isOptedOut &&
                                "is-selected",
                              isOptedOut && "is-dim",
                            )}
                            aria-pressed={selected === value && !isOptedOut}
                            aria-label={`Score ${value} for ${name}`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      {optOutAllowed && (
                        <div className="fi-wiz-optout">
                          <button
                            type="button"
                            onClick={() => handleOptOut(name)}
                            className={clsx(
                              "fi-key",
                              isOptedOut && "is-latched",
                            )}
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

      {failurePanel && <div className="fi-wiz-failure">{failurePanel}</div>}

      {isReviewing ? (
        <footer className="fi-wiz-rail fi-wiz-rail--foot">
          <p className="scoring-footer-note">
            {isReviewing
              ? `${completedCount} project${completedCount === 1 ? "" : "s"} ready to submit`
              : "Review all scores before submitting."}
          </p>
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
              disabled={submitting || checkingSave || completedCount === 0}
            >
              {submitting ? "Submitting…" : "Submit scores"}
            </button>
          </div>
        </footer>
      ) : (
        <footer className="fi-wiz-rail fi-wiz-rail--foot">
          <p className="scoring-footer-note" aria-live="polite">
            {canAdvance
              ? "Review all scores before submitting."
              : `Score every category to continue · ${currentUnansweredCount} left`}
          </p>
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
              disabled={!canAdvance}
            >
              Next <DirectionIcon />
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
  missing: number;
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
        <h2 className="fi-zone" id="scoring-review-heading">
          Review scores
        </h2>
        <span className="fi-engraved">
          {pad2(completedCount)} of {pad2(totalTeams)} scored
          {skippedCount > 0 ? ` · ${pad2(skippedCount)} skipped` : ""}
        </span>
      </div>

      <div className="fi-wiz-ledger">
        {entries.map(({ team, index, status, scores, missing }) => (
          <div key={team._id} className="fi-wiz-row">
            <h3 className="fi-wiz-row-name">{team.name}</h3>
            <span
              className={clsx(
                "fi-wiz-stamp",
                status === "completed" && "is-done",
                status === "skipped" && "is-skipped",
                status === "incomplete" && "is-incomplete",
              )}
            >
              {STAMP_LABEL[status]}
            </span>
            <div className="fi-wiz-readouts">
              {status === "incomplete" ? (
                <p className="fi-wiz-open-copy">
                  {missing} {missing === 1 ? "category" : "categories"} left ·
                  Not submitted
                </p>
              ) : status !== "pending" && Object.keys(scores).length > 0 ? (
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
                      <span className="fi-engraved-sm">{category}</span>
                      <span className="fi-engraved-sm fi-wiz-readout-weight">
                        {formatRubricPercent(
                          rubricPercentByCategory.get(category) ?? 0,
                        )}
                      </span>
                      <span
                        className="fi-engraved-sm fi-wiz-readout-dash"
                        aria-hidden="true"
                      >
                        –
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
