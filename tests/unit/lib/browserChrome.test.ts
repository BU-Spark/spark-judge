import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserChromeColor, syncBrowserChrome } from "../../../src/lib/browserChrome";

const startup = readFileSync("public/theme-init.js", "utf8");

afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelectorAll('[name="theme-color"]').forEach((meta) => meta.remove());
  document.documentElement.removeAttribute("style");
  window.history.replaceState({}, "", "/");
});

describe("browser chrome", () => {
  it.each([
    ["/", "#103c3b"],
    ["/homepage-preview", "#103c3b"],
    ["/event/event-1", "#073e39"],
    ["/event/event-1/team/team-1", "#ddd9d0"],
    ["/admin", "#ddd9d0"],
    ["/profile", "#103c3b"],
    ["/events", "#ddd9d0"],
  ])("matches initial and client-side colors for %s", (path, color) => {
    window.history.replaceState({}, "", path);
    window.eval(startup);
    expect(getBrowserChromeColor(path)).toBe(color);
    expect(document.documentElement.style.getPropertyValue("--browser-chrome")).toBe(color);
    expect(document.getElementById("theme-color-meta")).toHaveAttribute("content", color);
    syncBrowserChrome(path);
    expect(document.documentElement.style.getPropertyValue("--browser-chrome")).toBe(color);
    expect(document.documentElement.style.colorScheme).toBe(color === "#ddd9d0" ? "light" : "dark");
    expect(document.getElementById("theme-color-meta")).toHaveAttribute("content", color);
  });

  it("updates a single theme tag when navigating away and back", () => {
    window.eval(startup);
    for (const path of ["/admin", "/event/event-1", "/", "/profile", "/"]) {
      syncBrowserChrome(path);
      expect(document.getElementById("theme-color-meta")).toHaveAttribute("content", getBrowserChromeColor(path));
    }
    expect(document.head.querySelectorAll('[name="theme-color"]')).toHaveLength(1);
    expect(document.documentElement.style.getPropertyValue("--browser-chrome")).toBe("#103c3b");
  });

  it("still sets the canvas when local storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    expect(() => window.eval(startup)).not.toThrow();
    expect(document.getElementById("theme-color-meta")).toHaveAttribute("content", "#103c3b");
    expect(document.documentElement).toHaveClass("light");
  });
});
