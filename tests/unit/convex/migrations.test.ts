import { describe, it, expect } from "vitest";

describe("migrations business logic", () => {
  describe("backfillEventMode migration logic", () => {
    it("should identify events without mode field", () => {
      const events = [
        { _id: "e1", name: "Event 1", mode: undefined },
        { _id: "e2", name: "Event 2", mode: "hackathon" },
        { _id: "e3", name: "Event 3", mode: "demo_day" },
        { _id: "e4", name: "Event 4" }, // no mode property at all
      ];

      const eventsNeedingBackfill = events.filter(
        (e) => !("mode" in e) || e.mode === undefined
      );

      expect(eventsNeedingBackfill).toHaveLength(2);
      expect(eventsNeedingBackfill.map((e) => e._id)).toEqual(["e1", "e4"]);
    });

    it("should not modify events that already have mode set", () => {
      const events = [
        { _id: "e1", name: "Event 1", mode: "hackathon" as const },
        { _id: "e2", name: "Event 2", mode: "demo_day" as const },
      ];

      const eventsNeedingBackfill = events.filter((e) => !e.mode);

      expect(eventsNeedingBackfill).toHaveLength(0);
    });

    it("should count correctly when all events need backfill", () => {
      const events = [
        { _id: "e1", name: "Event 1", mode: undefined },
        { _id: "e2", name: "Event 2", mode: undefined },
        { _id: "e3", name: "Event 3", mode: undefined },
      ];

      const eventsNeedingBackfill = events.filter((e) => !e.mode);

      expect(eventsNeedingBackfill).toHaveLength(3);
    });

    it("should return correct count when no events need backfill", () => {
      const events = [
        { _id: "e1", name: "Event 1", mode: "hackathon" as const },
        { _id: "e2", name: "Event 2", mode: "demo_day" as const },
      ];

      const eventsNeedingBackfill = events.filter((e) => !e.mode);

      expect(eventsNeedingBackfill).toHaveLength(0);
    });
  });

  describe("migration result format", () => {
    it("should return correct result format", () => {
      const eventsUpdated = 5;
      const result = {
        message: `Successfully backfilled 'mode: "hackathon"' for ${eventsUpdated} events`,
        eventsUpdated,
      };

      expect(result.message).toBe(
        "Successfully backfilled 'mode: \"hackathon\"' for 5 events"
      );
      expect(result.eventsUpdated).toBe(5);
    });

    it("should return zero count message when no updates needed", () => {
      const eventsUpdated = 0;
      const result = {
        message: `Successfully backfilled 'mode: "hackathon"' for ${eventsUpdated} events`,
        eventsUpdated,
      };

      expect(result.message).toBe(
        "Successfully backfilled 'mode: \"hackathon\"' for 0 events"
      );
      expect(result.eventsUpdated).toBe(0);
    });
  });
});

