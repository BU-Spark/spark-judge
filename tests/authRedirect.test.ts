import { describe, expect, it } from "vitest";
import { authRedirect } from "../convex/authRedirect";

const dev = "https://hackjudge-dev-development.up.railway.app";

describe("shared frontend auth redirects", () => {
  it("returns users to either approved frontend", () => {
    expect(authRedirect(dev, dev)).toBe(`${dev}/`);
    expect(authRedirect("https://hackjudge.netlify.app/profile", dev))
      .toBe("https://hackjudge.netlify.app/profile");
    expect(authRedirect("/profile", dev)).toBe(`${dev}/profile`);
  });

  it.each([
    "https://hackjudge.netlify.app.attacker.example",
    "//attacker.example",
    "https://hackjudge.netlify.app@attacker.example",
    "https://user@hackjudge.netlify.app",
    "javascript:alert(1)",
    "http://hackjudge.netlify.app",
  ])("rejects unapproved redirect %s", (url) => {
    expect(() => authRedirect(url, dev)).toThrow();
  });
});
