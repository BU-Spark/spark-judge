import { describe, expect, it } from "vitest";

import {
  DEMO_DAY_TURNSTILE_ACTION,
  getExpectedTurnstileHostname,
  validateTurnstileResponse,
} from "../../../convex/http";

describe("HTTP Turnstile validation", () => {
  it("requires the expected action and configured hostname", () => {
    expect(
      validateTurnstileResponse(
        {
          success: true,
          action: DEMO_DAY_TURNSTILE_ACTION,
          hostname: "hackjudge.netlify.app",
        },
        "hackjudge.netlify.app",
      ),
    ).toEqual({ success: true });

    expect(
      validateTurnstileResponse(
        { success: true, action: "other_action", hostname: "hackjudge.netlify.app" },
        "hackjudge.netlify.app",
      ).success,
    ).toBe(false);
    expect(
      validateTurnstileResponse(
        { success: true, action: DEMO_DAY_TURNSTILE_ACTION, hostname: "evil.example" },
        "hackjudge.netlify.app",
      ).success,
    ).toBe(false);
  });

  it("derives the expected hostname from SITE_URL or an explicit hostname", () => {
    expect(
      getExpectedTurnstileHostname({ SITE_URL: "https://hackjudge.netlify.app" }),
    ).toBe("hackjudge.netlify.app");
    expect(
      getExpectedTurnstileHostname({ TURNSTILE_EXPECTED_HOSTNAME: "example.com" }),
    ).toBe("example.com");
  });
});
