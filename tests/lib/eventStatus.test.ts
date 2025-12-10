import { describe, it, expect } from "vitest";
import { computeEventDisplayStatus } from "../../src/lib/eventStatus";

describe("computeEventDisplayStatus", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  it("returns upcoming when now is before start", () => {
    const start = now + day;
    const end = now + 2 * day;
    expect(
      computeEventDisplayStatus({
        startDate: start,
        endDate: end,
        status: "upcoming",
        now,
      })
    ).toBe("upcoming");
  });

  it("returns active when now is between start and end", () => {
    const start = now - day;
    const end = now + day;
    expect(
      computeEventDisplayStatus({
        startDate: start,
        endDate: end,
        status: "active",
        now,
      })
    ).toBe("active");
  });

  it("returns past when now is after end", () => {
    const start = now - 2 * day;
    const end = now - day;
    expect(
      computeEventDisplayStatus({
        startDate: start,
        endDate: end,
        status: "active",
        now,
      })
    ).toBe("past");
  });

  it("returns past when stored status is past even if dates are future", () => {
    const start = now + day;
    const end = now + 2 * day;
    expect(
      computeEventDisplayStatus({
        startDate: start,
        endDate: end,
        status: "past",
        now,
      })
    ).toBe("past");
  });
});

