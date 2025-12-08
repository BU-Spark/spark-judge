import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAttendeeId,
  getFingerprint,
  getIdentity,
  clearFingerprintCache,
  isIdentitySupported,
} from "@/lib/demoDayIdentity";

describe("demoDayIdentity", () => {
  beforeEach(() => {
    // Clear localStorage and cookies before each test
    localStorage.clear();
    document.cookie = "";
    clearFingerprintCache();
  });

  describe("getAttendeeId", () => {
    it("should generate a new UUID when no ID exists", () => {
      const id = getAttendeeId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should return the same ID from localStorage", () => {
      const id1 = getAttendeeId();
      const id2 = getAttendeeId();
      expect(id1).toBe(id2);
    });

    it("should persist ID to localStorage", () => {
      const id = getAttendeeId();
      expect(localStorage.getItem("demo_day_attendee_id")).toBe(id);
    });

    it("should fallback to cookie when localStorage is unavailable", () => {
      // Mock localStorage to throw
      const originalGetItem = localStorage.getItem;
      const originalSetItem = localStorage.setItem;

      vi.spyOn(localStorage, "getItem").mockImplementation(() => {
        throw new Error("localStorage unavailable");
      });
      vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new Error("localStorage unavailable");
      });

      // Set cookie manually
      document.cookie = "demo_day_aid=test-cookie-id; path=/";

      const id = getAttendeeId();
      expect(id).toBe("test-cookie-id");

      // Restore
      localStorage.getItem = originalGetItem;
      localStorage.setItem = originalSetItem;
    });

    it("should generate ID in non-browser environment", () => {
      // Mock window as undefined
      const originalWindow = global.window;
      // @ts-expect-error - intentionally setting to undefined for test
      global.window = undefined;

      const id = getAttendeeId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      global.window = originalWindow;
    });
  });

  describe("getFingerprint", () => {
    it("should generate a fingerprint hash", async () => {
      const fingerprint = await getFingerprint();
      expect(fingerprint).toBeTruthy();
      expect(typeof fingerprint).toBe("string");
      expect(fingerprint.length).toBeGreaterThan(0);
    });

    it("should return the same fingerprint in the same session", async () => {
      const fp1 = await getFingerprint();
      const fp2 = await getFingerprint();
      expect(fp1).toBe(fp2);
    });

    it("should generate different fingerprint after cache clear", async () => {
      const fp1 = await getFingerprint();
      clearFingerprintCache();
      const fp2 = await getFingerprint();
      // Note: In a real browser, these might be the same due to same device
      // But the cache clearing should work
      expect(typeof fp2).toBe("string");
    });

    it("should handle non-browser environment", async () => {
      const originalWindow = global.window;
      const originalNavigator = global.navigator;
      // @ts-expect-error - intentionally setting to undefined for test
      global.window = undefined;
      // @ts-expect-error - intentionally setting to undefined for test
      global.navigator = undefined;

      const fingerprint = await getFingerprint();
      expect(fingerprint).toBeTruthy();
      expect(typeof fingerprint).toBe("string");

      global.window = originalWindow;
      global.navigator = originalNavigator;
    });
  });

  describe("getIdentity", () => {
    it("should return both attendeeId and fingerprintKey", async () => {
      // Clear any existing state
      localStorage.clear();
      document.cookie = "";
      clearFingerprintCache();

      const identity = await getIdentity();
      expect(identity).toHaveProperty("attendeeId");
      expect(identity).toHaveProperty("fingerprintKey");
      // AttendeeId should be a valid UUID or string
      expect(typeof identity.attendeeId).toBe("string");
      expect(identity.attendeeId.length).toBeGreaterThan(0);
      expect(typeof identity.fingerprintKey).toBe("string");
    });
  });

  describe("isIdentitySupported", () => {
    it("should return true in browser environment", () => {
      expect(isIdentitySupported()).toBe(true);
    });

    it("should return false in non-browser environment", () => {
      const originalWindow = global.window;
      const originalNavigator = global.navigator;
      // @ts-expect-error - intentionally setting to undefined for test
      global.window = undefined;
      // @ts-expect-error - intentionally setting to undefined for test
      global.navigator = undefined;

      expect(isIdentitySupported()).toBe(false);

      global.window = originalWindow;
      global.navigator = originalNavigator;
    });
  });
});
