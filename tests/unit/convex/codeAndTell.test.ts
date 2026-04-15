import { describe, expect, it } from "vitest";

import {
  computeCodeAndTellStandings,
  getRequiredRankCount,
  validateRankedBallot,
} from "../../../convex/codeAndTell";
import type { Id } from "../../../convex/_generated/dataModel";

describe("codeAndTell helpers", () => {
  it("caps the required rank count at five", () => {
    expect(getRequiredRankCount(0)).toBe(0);
    expect(getRequiredRankCount(3)).toBe(3);
    expect(getRequiredRankCount(9)).toBe(5);
  });

  it("rejects duplicate ballot entries", () => {
    expect(() =>
      validateRankedBallot({
        rankedTeamIds: ["team-1", "team-1"] as Id<"teams">[],
        visibleTeamIds: new Set(["team-1", "team-2"] as Id<"teams">[]),
        ownProjectIds: new Set<Id<"teams">>(),
        requiredRankCount: 2,
      }),
    ).toThrow("duplicate or unavailable projects");
  });

  it("rejects self-ranked projects", () => {
    expect(() =>
      validateRankedBallot({
        rankedTeamIds: ["team-1"] as Id<"teams">[],
        visibleTeamIds: new Set(["team-1"] as Id<"teams">[]),
        ownProjectIds: new Set(["team-1"] as Id<"teams">[]),
        requiredRankCount: 1,
      }),
    ).toThrow("associated with your email");
  });

  it("rejects ballots that do not fill all required slots", () => {
    expect(() =>
      validateRankedBallot({
        rankedTeamIds: ["team-1"] as Id<"teams">[],
        visibleTeamIds: new Set(["team-1", "team-2"] as Id<"teams">[]),
        ownProjectIds: new Set<Id<"teams">>(),
        requiredRankCount: 2,
      }),
    ).toThrow("Ballots must rank exactly 2 projects");
  });

  it("uses K-Borda weights when a ballot ranks K projects", () => {
    const summary = computeCodeAndTellStandings(
      [
        { _id: "team-1" as Id<"teams">, name: "Alpha", description: "" },
        { _id: "team-2" as Id<"teams">, name: "Beta", description: "" },
      ],
      [["team-1", "team-2"] as Id<"teams">[]],
    );

    expect(summary.standings[0]).toMatchObject({
      teamId: "team-1",
      points: 2,
    });
    expect(summary.standings[1]).toMatchObject({
      teamId: "team-2",
      points: 1,
    });
  });

  it("breaks ties by higher first-place counts before project name", () => {
    const summary = computeCodeAndTellStandings(
      [
        { _id: "team-a" as Id<"teams">, name: "Alpha", description: "" },
        { _id: "team-b" as Id<"teams">, name: "Beta", description: "" },
        { _id: "team-c" as Id<"teams">, name: "Gamma", description: "" },
        { _id: "team-d" as Id<"teams">, name: "Delta", description: "" },
      ],
      [
        ["team-a", "team-b", "team-c", "team-d"] as Id<"teams">[],
        ["team-c", "team-d", "team-b", "team-a"] as Id<"teams">[],
      ],
    );

    const alpha = summary.standings.find((row) => row.teamId === "team-a");
    const beta = summary.standings.find((row) => row.teamId === "team-b");

    expect(alpha).toBeTruthy();
    expect(beta).toBeTruthy();
    expect(alpha!.points).toBe(beta!.points);
    expect(alpha!.rankCounts[0]).toBeGreaterThan(
      beta!.rankCounts[0],
    );
    expect(
      summary.standings.findIndex((row) => row.teamId === "team-a"),
    ).toBeLessThan(
      summary.standings.findIndex((row) => row.teamId === "team-b"),
    );
  });

  it("falls back to project name when points and rank counts are identical", () => {
    const summary = computeCodeAndTellStandings(
      [
        { _id: "team-a" as Id<"teams">, name: "Alpha", description: "" },
        { _id: "team-b" as Id<"teams">, name: "Beta", description: "" },
      ],
      [
        ["team-a", "team-b"] as Id<"teams">[],
        ["team-b", "team-a"] as Id<"teams">[],
      ],
    );

    expect(summary.standings[0].teamId).toBe("team-a");
    expect(summary.standings[1].teamId).toBe("team-b");
    expect(summary.standings[0].points).toBe(summary.standings[1].points);
    expect(summary.standings[0].rankCounts).toEqual(
      summary.standings[1].rankCounts,
    );
  });
});
