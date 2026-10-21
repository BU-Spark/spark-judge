import { describe, expect, it } from "vitest";
import {
  getEffectivePrizeSubmissions,
  type EntryPrize,
} from "../../../shared/prizeEntries";

const env: EntryPrize = {
  _id: "env",
  eventId: "event",
  type: "track",
  track: "Environment",
  entryMode: "automatic",
};
const first: EntryPrize = {
  _id: "first",
  eventId: "event",
  type: "general",
  entryMode: "opt_in",
};
const sponsor: EntryPrize = {
  _id: "sponsor",
  eventId: "event",
  type: "sponsor",
  entryMode: "opt_in",
};
const team = { _id: "team", eventId: "event", track: "Environment" };
const choice = (prizeId: string) => ({
  eventId: "event",
  teamId: "team",
  prizeId,
});

describe("automatic and selected prize entries", () => {
  it("includes matching automatic entries without a saved submission", () => {
    expect(getEffectivePrizeSubmissions([env, first], [team], [])).toEqual([
      { ...choice("env"), automatic: true },
    ]);
  });
  it("combines multiple explicit choices with automatic entries once each", () => {
    const entries = getEffectivePrizeSubmissions(
      [env, first, sponsor],
      [team],
      [choice("first"), choice("first"), choice("env"), choice("sponsor")],
    );
    expect(entries.map((row) => row.prizeId).sort()).toEqual([
      "env",
      "first",
      "sponsor",
    ]);
    expect(entries.find((row) => row.prizeId === "env")).toHaveProperty(
      "automatic",
      true,
    );
  });
  it("leaves legacy prizes opt-in until explicitly configured", () => {
    expect(
      getEffectivePrizeSubmissions(
        [{ ...env, entryMode: undefined }],
        [team],
        [],
      ),
    ).toEqual([]);
  });
  it("removes automatic entry when the team's track changes, including stale saved rows", () => {
    expect(
      getEffectivePrizeSubmissions(
        [env],
        [{ ...team, track: "Health" }],
        [choice("env")],
      ),
    ).toEqual([]);
  });
  it.each([
    { ...env, isActive: false },
    { ...env, eventId: "another-event" },
  ])("does not enter inactive or other-event prizes", (prize) => {
    expect(
      getEffectivePrizeSubmissions([prize], [team], [choice("env")]),
    ).toEqual([]);
  });
  it("excludes hidden teams from automatic and optional entries", () => {
    expect(
      getEffectivePrizeSubmissions(
        [env, first],
        [{ ...team, hidden: true }],
        [choice("first")],
      ),
    ).toEqual([]);
  });
  it("does not automatically enter a general prize even if its configuration is malformed", () => {
    expect(
      getEffectivePrizeSubmissions(
        [{ ...first, entryMode: "automatic" }],
        [team],
        [],
      ),
    ).toEqual([]);
  });
  it("discards deleted prizes and submissions for another team", () => {
    expect(
      getEffectivePrizeSubmissions(
        [first],
        [team],
        [choice("deleted"), { ...choice("first"), teamId: "other" }],
      ),
    ).toEqual([]);
  });
});
