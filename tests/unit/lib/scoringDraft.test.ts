import { beforeEach, describe, expect, it } from "vitest";

import { writeDraft } from "../../../src/lib/draftStorage";
import {
  draftAfterSubmit,
  readScoringDraftSummary,
  scoringDraftKey,
  type ScoringDraft,
} from "../../../src/lib/scoringDraft";

const answered = { score: 3, optedOut: false };

describe("draftAfterSubmit", () => {
  const draft: ScoringDraft = {
    scores: {
      a: { Impact: answered, Craft: answered },
      b: { Impact: answered },
      c: {},
      d: { Impact: answered },
    },
    completed: ["a", "b"],
    skipped: ["c", "d"],
    currentTeamId: "a",
  };

  it("keeps only unsubmitted teams with saved answers", () => {
    expect(draftAfterSubmit(draft, ["a"], ["d", "c", "b", "a"])).toEqual({
      scores: { b: { Impact: answered }, d: { Impact: answered } },
      completed: ["b"],
      skipped: ["d"],
      currentTeamId: "d",
    });
  });

  it("returns null when nothing unsubmitted remains", () => {
    expect(draftAfterSubmit(draft, ["a", "b", "d"])).toBeNull();
  });
});

describe("readScoringDraftSummary", () => {
  beforeEach(() => window.localStorage.clear());

  it("reports a kept partial draft and its completed team IDs", () => {
    writeDraft(scoringDraftKey("k"), 2, {
      scores: { b: { Impact: answered } },
      completed: [],
      skipped: [],
      currentTeamId: "b",
    });
    expect(readScoringDraftSummary("k")).toEqual({
      hasDraft: true,
      completedCount: 0,
      completedTeamIds: [],
    });
  });

  it("ignores a draft marked as submitted", () => {
    writeDraft(scoringDraftKey("k"), 2, {
      scores: {},
      completed: [],
      skipped: [],
      currentTeamId: null,
      submittedAt: 1,
    });
    expect(readScoringDraftSummary("k").hasDraft).toBe(false);
  });
});
