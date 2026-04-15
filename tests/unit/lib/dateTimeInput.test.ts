import { describe, expect, it } from "vitest";

import {
  formatDateTimeInput,
  getAutoAdjustedEndDateTime,
  parseDateTimeInput,
} from "@/lib/dateTimeInput";

describe("dateTimeInput helpers", () => {
  it("parses valid local datetime input values", () => {
    const parsed = parseDateTimeInput("2026-04-13T11:30");

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(3);
    expect(parsed?.getDate()).toBe(13);
    expect(parsed?.getHours()).toBe(11);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it("formats dates back into local datetime input strings", () => {
    expect(formatDateTimeInput(new Date(2026, 3, 13, 11, 30))).toBe(
      "2026-04-13T11:30"
    );
  });

  it("moves the end time one hour later when the new start passes it", () => {
    expect(
      getAutoAdjustedEndDateTime("2026-04-13T18:00", "2026-04-13T17:00")
    ).toBe("2026-04-13T19:00");
  });

  it("leaves the end time alone when the new start is still before it", () => {
    expect(
      getAutoAdjustedEndDateTime("2026-04-13T16:00", "2026-04-13T17:00")
    ).toBe("2026-04-13T17:00");
  });
});
