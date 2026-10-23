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

  it("returns users to Netlify draft deploys of this site", () => {
    expect(
      authRedirect("https://6720f1c2a1b2c3d4e5f60718--hackjudge.netlify.app/admin", dev),
    ).toBe("https://6720f1c2a1b2c3d4e5f60718--hackjudge.netlify.app/admin");
  });

  it.each([
    "https://hackjudge.netlify.app.attacker.example",
    "//attacker.example",
    "https://hackjudge.netlify.app@attacker.example",
    "https://user@hackjudge.netlify.app",
    "javascript:alert(1)",
    "http://hackjudge.netlify.app",
    "http://abc123--hackjudge.netlify.app",
    "https://abc123--hackjudge.netlify.app:8443",
    "https://abc123--hackjudge.netlify.app.attacker.example",
    "https://abc123--otherjudge.netlify.app",
    "https://evil.abc123--hackjudge.netlify.app",
    "https://user@abc123--hackjudge.netlify.app",
  ])("rejects unapproved redirect %s", (url) => {
    expect(() => authRedirect(url, dev)).toThrow();
  });
});
