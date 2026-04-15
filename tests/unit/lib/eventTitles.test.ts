import { describe, expect, it } from "vitest";

import {
  formatCodeAndTellDefaultTitle,
  formatLocalDateNoTime,
} from "@/lib/eventTitles";

describe("eventTitles", () => {
  it("formats a local calendar date without time", () => {
    const s = formatLocalDateNoTime(Date.UTC(2026, 3, 14, 12, 0, 0));
    expect(s).toMatch(/2026/);
    expect(s).toMatch(/14/);
  });

  it("builds the default Code & Tell title", () => {
    expect(formatCodeAndTellDefaultTitle(Date.UTC(2026, 3, 14, 12, 0, 0))).toBe(
      `Code & Tell (${formatLocalDateNoTime(Date.UTC(2026, 3, 14, 12, 0, 0))})`,
    );
  });
});
