import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { sendAppreciation, useAppreciation } from "@/lib/demoDayApi";
import * as demoDayIdentity from "@/lib/demoDayIdentity";

// Mock the identity module
vi.mock("@/lib/demoDayIdentity", () => ({
  getIdentity: vi.fn(),
}));

describe("demoDayApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("sendAppreciation", () => {
    it("should send appreciation request with correct data", async () => {
      const mockIdentity = {
        attendeeId: "test-attendee-id",
        fingerprintKey: "test-fingerprint",
      };
      vi.mocked(demoDayIdentity.getIdentity).mockResolvedValue(mockIdentity);

      const mockResponse = {
        success: true,
        remainingForTeam: 2,
        remainingTotal: 14,
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await sendAppreciation("event-id", "team-id");

      expect(demoDayIdentity.getIdentity).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/demo-day/appreciations"),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId: "event-id",
            teamId: "team-id",
            attendeeId: "test-attendee-id",
            fingerprintKey: "test-fingerprint",
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle error response", async () => {
      const mockIdentity = {
        attendeeId: "test-attendee-id",
        fingerprintKey: "test-fingerprint",
      };
      vi.mocked(demoDayIdentity.getIdentity).mockResolvedValue(mockIdentity);

      const mockErrorResponse = {
        success: false,
        error: "Rate limit exceeded",
        remainingForTeam: 0,
        remainingTotal: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: async () => mockErrorResponse,
      } as Response);

      const result = await sendAppreciation("event-id", "team-id");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded");
    });

    it("should handle network errors", async () => {
      vi.mocked(demoDayIdentity.getIdentity).mockResolvedValue({
        attendeeId: "test-id",
        fingerprintKey: "test-fp",
      });

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(sendAppreciation("event-id", "team-id")).rejects.toThrow();
    });
  });

  describe("useAppreciation hook", () => {
    it("should initialize with correct default state", () => {
      const { result } = renderHook(() => useAppreciation());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.appreciate).toBe("function");
      expect(typeof result.current.clearError).toBe("function");
    });

    it("should handle successful appreciation", async () => {
      vi.mocked(demoDayIdentity.getIdentity).mockResolvedValue({
        attendeeId: "test-id",
        fingerprintKey: "test-fp",
      });

      const mockResponse = {
        success: true,
        remainingForTeam: 2,
        remainingTotal: 14,
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useAppreciation());

      let promise: Promise<any>;
      act(() => {
        promise = result.current.appreciate("event-id", "team-id", onSuccess);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await promise!;

      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
      expect(result.current.error).toBe(null);
    });

    it("should handle error response", async () => {
      vi.mocked(demoDayIdentity.getIdentity).mockResolvedValue({
        attendeeId: "test-id",
        fingerprintKey: "test-fp",
      });

      const mockErrorResponse = {
        success: false,
        error: "Limit exceeded",
        remainingForTeam: 0,
        remainingTotal: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: async () => mockErrorResponse,
      } as Response);

      const onError = vi.fn();
      const { result } = renderHook(() => useAppreciation());

      await act(async () => {
        await result.current.appreciate(
          "event-id",
          "team-id",
          undefined,
          onError
        );
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe("Limit exceeded");
      });

      expect(onError).toHaveBeenCalledWith("Limit exceeded");
    });

    it("should handle network errors", async () => {
      vi.mocked(demoDayIdentity.getIdentity).mockResolvedValue({
        attendeeId: "test-id",
        fingerprintKey: "test-fp",
      });

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const onError = vi.fn();
      const { result } = renderHook(() => useAppreciation());

      await act(async () => {
        await result.current.appreciate(
          "event-id",
          "team-id",
          undefined,
          onError
        );
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe("Network error");
      });

      expect(onError).toHaveBeenCalledWith("Network error");
    });

    it("should clear error when clearError is called", async () => {
      vi.mocked(demoDayIdentity.getIdentity).mockResolvedValue({
        attendeeId: "test-id",
        fingerprintKey: "test-fp",
      });

      global.fetch = vi.fn().mockRejectedValue(new Error("Test error"));

      const { result } = renderHook(() => useAppreciation());

      await act(async () => {
        await result.current.appreciate("event-id", "team-id");
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Test error");
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });
});
