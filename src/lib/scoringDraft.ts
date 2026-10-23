/**
 * Versioned local draft for the judge scoring wizard, plus a one-time reader
 * for the unversioned draft format that predates it.
 */
import { draftKey, readDraft, safeGetItem } from "./draftStorage";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Pre-versioning draft shape, stored as raw JSON directly at `storageKey`. */
type LegacyDraftPayload = {
  scores?: Record<string, Record<string, unknown>>;
  completed?: string[];
  skipped?: string[];
  currentIndex?: number;
  timestamp?: number;
};

/**
 * Versioned draft (schema 2). The selected team is stored by ID so a roster
 * change cannot silently move the judge to a different project.
 */
export type ScoringDraft = {
  scores: Record<string, Record<string, unknown>>;
  completed: string[];
  skipped: string[];
  currentTeamId: string | null;
  /** Set when the batch was accepted but the draft could not be removed. */
  submittedAt?: number;
};

export const SCORING_DRAFT_SCHEMA = 2;
/** Versioned storage key for a wizard draft, scoped by the caller's key (event + user). */
export function scoringDraftKey(storageKey: string): string {
  return draftKey("scoring", storageKey);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isScoringDraft(value: unknown): value is ScoringDraft {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.scores) &&
    Object.values(value.scores).every((entry) => isRecord(entry)) &&
    isStringArray(value.completed) &&
    isStringArray(value.skipped) &&
    (value.currentTeamId === null || typeof value.currentTeamId === "string")
  );
}

/**
 * Lightweight read used outside the wizard (e.g. "resume draft" prompts).
 * Never throws; ignores drafts already marked as submitted.
 */
export function readScoringDraftSummary(storageKey: string): {
  hasDraft: boolean;
  completedCount: number;
  /** Teams the draft marks completed; may still need submitting. */
  completedTeamIds: string[];
} {
  const result = readDraft<ScoringDraft>(
    scoringDraftKey(storageKey),
    SCORING_DRAFT_SCHEMA,
    { isValid: isScoringDraft },
  );
  if (result.status === "found" && !result.data.submittedAt) {
    return {
      hasDraft: true,
      completedCount: result.data.completed.length,
      completedTeamIds: result.data.completed,
    };
  }
  const legacy = parseLegacyDraft(safeGetItem(storageKey));
  if (legacy) {
    return {
      hasDraft: true,
      completedCount: legacy.completed.length,
      completedTeamIds: legacy.completed,
    };
  }
  return { hasDraft: false, completedCount: 0, completedTeamIds: [] };
}

export function parseLegacyDraft(
  raw: string | null,
): (ScoringDraft & { currentIndex: number | null; savedAt: number | null }) | null {
  if (!raw) return null;
  let parsed: LegacyDraftPayload;
  try {
    parsed = JSON.parse(raw) as LegacyDraftPayload;
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.scores)) return null;
  return {
    scores: Object.fromEntries(
      Object.entries(parsed.scores).filter(([, value]) => isRecord(value)),
    ) as Record<string, Record<string, unknown>>,
    completed: isStringArray(parsed.completed) ? parsed.completed : [],
    skipped: isStringArray(parsed.skipped) ? parsed.skipped : [],
    currentTeamId: null,
    currentIndex:
      typeof parsed.currentIndex === "number" ? parsed.currentIndex : null,
    savedAt: typeof parsed.timestamp === "number" ? parsed.timestamp : null,
  };
}

/**
 * The part of a draft that is still unsubmitted after the server accepted a
 * batch: every team not in `submittedTeamIds` that has at least one saved
 * answer. Returns null when nothing is left to keep. The result never carries
 * `submittedAt`, so it is restored like any other draft.
 */
export function draftAfterSubmit(
  draft: ScoringDraft,
  submittedTeamIds: Iterable<string>,
  teamOrder: readonly string[] = [],
): ScoringDraft | null {
  const submitted = new Set(submittedTeamIds);
  const scores: ScoringDraft["scores"] = {};
  for (const [teamId, entry] of Object.entries(draft.scores)) {
    if (submitted.has(teamId) || Object.keys(entry).length === 0) continue;
    scores[teamId] = entry;
  }
  const remaining = Object.keys(scores);
  if (remaining.length === 0) return null;
  const keep = (id: string) => id in scores;
  const ordered = teamOrder.filter(keep);
  return {
    scores,
    completed: draft.completed.filter(keep),
    skipped: draft.skipped.filter(keep),
    currentTeamId: ordered[0] ?? remaining[0] ?? null,
  };
}
