import { afterEach, describe, expect, it, vi } from "vitest";
import { draftKey, quarantineDraft, readDraft, removeDraft, writeDraft } from "../../../src/lib/draftStorage";

describe("draftStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("scopes keys by workflow and identity", () => {
    expect(draftKey("ballot", "event1", "user1")).not.toBe(draftKey("ballot", "event1", "user2"));
  });

  it("round-trips a versioned draft", () => {
    const key = draftKey("test", "a");
    expect(writeDraft(key, 1, { score: 3 }).status).toBe("saved");
    const result = readDraft<{ score: number }>(key, 1);
    expect(result).toMatchObject({ status: "found", data: { score: 3 } });
  });

  it("reports drafts from another schema or corrupt JSON as unreadable, keeping the raw text", () => {
    const key = draftKey("test", "b");
    writeDraft(key, 1, { score: 3 });
    expect(readDraft(key, 2).status).toBe("unreadable");
    window.localStorage.setItem(key, "{not json");
    const result = readDraft(key, 1);
    expect(result).toEqual({ status: "unreadable", raw: "{not json" });
    quarantineDraft(key, "{not json");
    expect(window.localStorage.getItem(`${key}:unreadable`)).toBe("{not json");
    expect(readDraft(key, 1).status).toBe("missing");
  });

  it("expires old drafts", () => {
    const key = draftKey("test", "c");
    writeDraft(key, 1, { score: 3 });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000 * 60 * 60 * 24 * 30);
    expect(readDraft(key, 1).status).toBe("missing");
  });

  it("never throws when storage is blocked", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    const key = draftKey("test", "d");
    expect(writeDraft(key, 1, {}).status).toBe("unavailable");
    expect(readDraft(key, 1).status).toBe("unavailable");
    expect(removeDraft(key).status).toBe("unavailable");
  });
});
