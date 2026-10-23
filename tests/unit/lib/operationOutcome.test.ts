import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { errorMessage, outcomeForFailure, toRecoverableFailure } from "../../../src/lib/operationOutcome";
import { appError } from "../../../convex/helpers";

describe("toRecoverableFailure", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  it("trusts structured ConvexError data", () => {
    const failure = toRecoverableFailure(
      new ConvexError({ code: "scoring_locked", category: "lifecycle", message: "Scoring is locked." }),
      "submitScores",
    );
    expect(failure).toMatchObject({ code: "scoring_locked", category: "lifecycle", message: "Scoring is locked.", retryable: false });
    expect(outcomeForFailure(failure)).toBe("rejected");
  });

  it("extracts the application message from a wrapped server error", () => {
    const failure = toRecoverableFailure(
      new Error("[CONVEX M(scores:submit)] [Request ID: abc] Server Error\nUncaught Error: Voting is closed\n    at handler"),
      "vote",
    );
    expect(failure.category).toBe("lifecycle");
    expect(failure.message).toBe("Voting is closed");
  });

  it("hides redacted or unexpected server text behind safe copy", () => {
    const failure = toRecoverableFailure(new Error("[CONVEX M(x)] [Request ID: abc] Server Error"), "save");
    expect(failure.category).toBe("unexpected");
    expect(failure.message).not.toContain("CONVEX");
    expect(failure.reference).toMatch(/^[A-Z0-9]+$/);
  });

  it("treats network failures as an unknown outcome, not a rejection", () => {
    const failure = toRecoverableFailure(new TypeError("Failed to fetch"), "save");
    expect(failure.category).toBe("network");
    expect(failure.retryable).toBe(true);
    expect(outcomeForFailure(failure)).toBe("unknown");
  });
});

describe("server appError contract", () => {
  it("round-trips through toRecoverableFailure with its code, category, and retry time", () => {
    const failure = toRecoverableFailure(
      appError("judge_code_locked", "rate_limit", "Judge code verification is temporarily locked", {
        retryAfterMs: 60_000,
      }),
      "verify judge code",
    );
    expect(failure).toMatchObject({
      code: "judge_code_locked",
      category: "rate_limit",
      message: "Judge code verification is temporarily locked",
      retryAfterMs: 60_000,
      retryable: false,
    });
  });
});

describe("errorMessage", () => {
  it("uses the typed message instead of the serialized ConvexError text", () => {
    const error = appError("already_participant", "conflict", "You are already a participant for this event");
    expect(error.message).toContain("{");
    expect(errorMessage(error, "fallback")).toBe("You are already a participant for this event");
  });

  it("keeps plain error messages and falls back when there is none", () => {
    expect(errorMessage(new Error("Team name already exists"), "fallback")).toBe("Team name already exists");
    expect(errorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(errorMessage("nope", "fallback")).toBe("fallback");
    expect(errorMessage(new ConvexError("Plain data"), "fallback")).toBe("Plain data");
    expect(errorMessage(new ConvexError({ code: "x" }), "fallback")).toBe("fallback");
  });
});
