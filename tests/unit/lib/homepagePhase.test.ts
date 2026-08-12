import { describe, expect, it } from "vitest";
import {
  POST_HOLD_MS,
  PRE_WINDOW_MS,
  formatTeletextClock,
  pageCodeFor,
  selectFocalHomepage,
} from "../../../src/lib/homepagePhase";

const base = {
  name: "Event",
  startDate: 0,
  endDate: 0,
};

describe("selectFocalHomepage", () => {
  it("prefers the live event", () => {
    const now = 1_000_000;
    const focal = selectFocalHomepage(
      {
        active: [
          {
            ...base,
            _id: "a1",
            status: "active",
            startDate: now - 1000,
            endDate: now + 1000,
            mode: "hackathon",
          },
        ],
        upcoming: [
          {
            ...base,
            _id: "u1",
            status: "upcoming",
            startDate: now + 10_000,
            endDate: now + 20_000,
          },
        ],
        past: [],
      },
      now
    );
    expect(focal?.event._id).toBe("a1");
    expect(focal?.phase).toBe("live");
    expect(focal?.pageCode).toBe("P102");
  });

  it("keeps a just-ended event in post hold", () => {
    const now = 1_000_000;
    const focal = selectFocalHomepage(
      {
        active: [],
        upcoming: [],
        past: [
          {
            ...base,
            _id: "p1",
            status: "past",
            startDate: now - POST_HOLD_MS - 1000,
            endDate: now - 60_000,
            mode: "demo_day",
          },
        ],
      },
      now
    );
    expect(focal?.event._id).toBe("p1");
    expect(focal?.phase).toBe("post");
    expect(focal?.pageCode).toBe("P203");
  });

  it("selects upcoming within pre window", () => {
    const now = 1_000_000;
    const focal = selectFocalHomepage(
      {
        active: [],
        upcoming: [
          {
            ...base,
            _id: "u1",
            status: "upcoming",
            startDate: now + PRE_WINDOW_MS - 1000,
            endDate: now + PRE_WINDOW_MS + 5000,
            mode: "code_and_tell",
          },
        ],
        past: [
          {
            ...base,
            _id: "p1",
            status: "past",
            startDate: now - POST_HOLD_MS * 3,
            endDate: now - POST_HOLD_MS - 1000,
          },
        ],
      },
      now
    );
    expect(focal?.event._id).toBe("u1");
    expect(focal?.phase).toBe("pre");
    expect(focal?.pageCode).toBe("P301");
  });

  it("armed pre beats a replay-hold event", () => {
    const now = 10 * POST_HOLD_MS;
    const focal = selectFocalHomepage(
      {
        active: [],
        upcoming: [
          {
            ...base,
            _id: "u1",
            status: "upcoming",
            startDate: now + 24 * 3600_000,
            endDate: now + 30 * 3600_000,
          },
        ],
        past: [
          {
            ...base,
            _id: "p1",
            status: "past",
            startDate: now - 40 * 3600_000,
            endDate: now - 3600_000,
          },
        ],
      },
      now
    );
    expect(focal?.event._id).toBe("u1");
    expect(focal?.phase).toBe("pre");
  });

  it("idles in standby when nothing is in any window", () => {
    const now = 10 * PRE_WINDOW_MS;
    const focal = selectFocalHomepage(
      {
        active: [],
        upcoming: [
          {
            ...base,
            _id: "u1",
            status: "upcoming",
            startDate: now + PRE_WINDOW_MS + 1000,
            endDate: now + PRE_WINDOW_MS + 5000,
          },
        ],
        past: [
          {
            ...base,
            _id: "p1",
            status: "past",
            startDate: now - POST_HOLD_MS * 3,
            endDate: now - POST_HOLD_MS - 1000,
          },
        ],
      },
      now
    );
    expect(focal).toBeNull();
  });
});

describe("pageCodeFor / clock", () => {
  it("formats teletext clock", () => {
    expect(formatTeletextClock(3661000)).toBe("01:01:01");
  });

  it("maps modes", () => {
    expect(pageCodeFor("hackathon", "live")).toBe("P102");
    expect(pageCodeFor("demo_day", "pre")).toBe("P201");
  });
});
