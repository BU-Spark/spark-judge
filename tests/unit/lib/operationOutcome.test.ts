import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { outcomeForFailure, toRecoverableFailure } from "../../../src/lib/operationOutcome";

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
