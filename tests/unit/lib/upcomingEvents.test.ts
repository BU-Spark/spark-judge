import { describe, expect, it } from "vitest";
import { upcomingItems } from "../../../src/lib/upcomingEvents";

const dec11 = Date.parse("2026-12-11T20:00:00Z");

describe("upcomingItems", () => {
  it("merges the Demo Day award votes held on the same day", () => {
    const items = upcomingItems([
      { _id: "ct", name: "November 2026 Code & Tell: Monthly Demo Night", mode: "code_and_tell", startDate: dec11 - 1 },
      { _id: "xc", name: "XC475 Student Innovation - Demo Day Fall 2026", mode: "hackathon", startDate: dec11 },
      { _id: "ac", name: "Audience Choice - Demo Day Fall 2026", mode: "demo_day", startDate: dec11 },
    ]);
    expect(items.map((item) => [item.title, item.label])).toEqual([
      ["Code & Tell", "Monthly Demo Night"],
      ["Demo Day", "Fall 2026"],
    ]);
    expect(items[1].event._id).toBe("ac");
    expect(items[1].awards).toEqual(["Audience Choice", "XC475 Innovation Award"]);
  });

  it("groups undated Demo Day votes by season and keeps other seasons apart", () => {
    const items = upcomingItems([
      { _id: "a", name: "Audience Choice - Demo Day Spring 2027", mode: "demo_day", startDate: 0 },
      { _id: "b", name: "XC475 Student Innovation - Demo Day Spring 2027", mode: "hackathon", startDate: 0 },
      { _id: "c", name: "Demo Day - Fall 2027", mode: "demo_day", startDate: 0 },
    ]);
    expect(items.map((item) => [item.label, item.awards])).toEqual([
      ["Spring 2027", ["Audience Choice", "XC475 Innovation Award"]],
      ["Fall 2027", ["Audience Choice"]],
    ]);
  });
});
