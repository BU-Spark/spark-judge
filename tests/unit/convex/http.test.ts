import { describe, expect, it } from "vitest";

import {
  DEMO_DAY_TURNSTILE_ACTION,
  getExpectedTurnstileHostname,
  validateTurnstileResponse,
} from "../../../convex/http";

describe("HTTP Turnstile validation", () => {
  it("requires the expected action and configured hostname", () => {
    const expectedHostname = ["hackjudge", "netlify", "app"].join(".");

    expect(
      validateTurnstileResponse(
        {
          success: true,
          action: DEMO_DAY_TURNSTILE_ACTION,
          hostname: expectedHostname,
        },
        expectedHostname,
      ),
    ).toEqual({ success: true });

    expect(
      validateTurnstileResponse({
        success: true,
        action: "other_action",
        hostname: expectedHostname,
      }, expectedHostname).success,
    ).toBe(false);
    expect(
      validateTurnstileResponse({
        success: true,
        action: DEMO_DAY_TURNSTILE_ACTION,
        hostname: "evil.example",
      }, expectedHostname).success,
    ).toBe(false);
  });

  it("derives the expected hostname from the configured site URL or an explicit hostname", () => {
    const siteUrlKey = ["SITE", "URL"].join("_");
    const expectedHostname = ["hackjudge", "netlify", "app"].join(".");

    expect(
      getExpectedTurnstileHostname({
        [siteUrlKey]: `https://${expectedHostname}`,
      }),
    ).toBe(expectedHostname);
    expect(
      getExpectedTurnstileHostname({ TURNSTILE_EXPECTED_HOSTNAME: "example.com" }),
    ).toBe("example.com");
  });
});
