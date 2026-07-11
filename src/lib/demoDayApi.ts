/**
 * Demo Day API Client
 *
 * Handles API calls to the Demo Day appreciation endpoints.
 */

import { useState, useCallback } from "react";

import { getIdentity } from "./demoDayIdentity";
import { useAuthToken } from "@convex-dev/auth/react";

// Get the Convex site URL from environment or derive from deployment
function getConvexSiteUrl(): string {
  // In production, this should be set via environment variable
  // For development, we can derive it from the Convex deployment
  if (typeof window !== "undefined") {
    // Check for environment variable first
    const envUrl = import.meta.env.VITE_CONVEX_SITE_URL;
    if (envUrl) return envUrl;

    // Try to derive from VITE_CONVEX_URL
    const convexUrl = import.meta.env.VITE_CONVEX_URL;
    if (convexUrl) {
      // Convert https://xxx.convex.cloud to https://xxx.convex.site
      return convexUrl.replace(".convex.cloud", ".convex.site");
    }
  }

  // Fallback - this should be configured properly in production
  console.warn("VITE_CONVEX_SITE_URL not configured, using relative path");
  return "";
}

export interface AppreciationResult {
  success: boolean;
  error?: string;
  requiresCaptcha?: boolean;
  captchaReason?: string;
  remainingForTeam: number;
  remainingTotal: number;
  integrity?: {
    reviewStatus: "accepted" | "flagged" | "rejected";
    riskScore: number;
    riskReasons: string[];
  };
}

export interface AppreciationOptions {
  requestLocation?: boolean;
}

type LocationPayload = {
  status:
    | "in_range"
    | "out_of_range"
    | "denied"
    | "unavailable"
    | "inaccurate"
    | "unknown";
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
};

type ClientSignals = {
  webdriver?: boolean;
  isLikelyMobile?: boolean;
  userAgentDataMobile?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  language?: string;
  timezone?: string;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
  sitekey: string;
  size: "invisible";
  action?: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function getTurnstileSiteKey(): string {
  return import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Verification is unavailable"));
  }
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Verification failed to load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Verification failed to load"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

async function executeTurnstile(): Promise<string> {
  const siteKey = getTurnstileSiteKey();
  if (!siteKey) {
    throw new Error("Verification is required but not configured");
  }

  await loadTurnstileScript();
  if (!window.turnstile) {
    throw new Error("Verification is unavailable");
  }

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  document.body.appendChild(container);

  return await new Promise((resolve, reject) => {
    let settled = false;
    let widgetId: string | null = null;
    const cleanup = () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      container.remove();
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    widgetId = window.turnstile.render(container, {
      sitekey: siteKey,
      size: "invisible",
      action: "demo_day_appreciation",
      callback: (token) => settle(() => resolve(token)),
      "error-callback": () =>
        settle(() => reject(new Error("Verification failed"))),
      "expired-callback": () =>
        settle(() => reject(new Error("Verification expired"))),
    });
    window.turnstile.execute(widgetId);
  });
}

async function collectLocation(
  requestLocation?: boolean,
): Promise<LocationPayload | undefined> {
  if (!requestLocation) return undefined;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "unavailable" };
  }

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "unknown",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ status: "denied" });
          return;
        }
        resolve({ status: "unavailable" });
      },
      {
        enableHighAccuracy: false,
        maximumAge: 2 * 60 * 1000,
        timeout: 4000,
      },
    );
  });
}

function collectClientSignals(): ClientSignals {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {};
  }
  const nav = navigator as Navigator & {
    webdriver?: boolean;
    userAgentData?: { mobile?: boolean };
  };
  const ua = navigator.userAgent || "";
  const uaLooksMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const touchLooksMobile =
    (navigator.maxTouchPoints || 0) > 0 && window.innerWidth <= 1024;

  return {
    webdriver: nav.webdriver === true,
    isLikelyMobile: uaLooksMobile || touchLooksMobile,
    userAgentDataMobile: nav.userAgentData?.mobile,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Send an appreciation to a team via the HTTP endpoint.
 * This uses the HTTP endpoint to capture accurate IP/UA metadata.
 */
export async function sendAppreciation(
  eventId: string,
  teamId: string,
  options: AppreciationOptions = {},
  authToken?: string | null,
): Promise<AppreciationResult> {
  // Get identity data
  const { attendeeId, fingerprintKey } = await getIdentity();
  const [location, clientSignals] = await Promise.all([
    collectLocation(options.requestLocation),
    Promise.resolve(collectClientSignals()),
  ]);

  const baseUrl = getConvexSiteUrl();
  const url = `${baseUrl}/demo-day/appreciations`;

  const postAppreciation = async (turnstileToken?: string) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        eventId,
        teamId,
        attendeeId,
        fingerprintKey,
        ...(turnstileToken ? { turnstileToken } : {}),
        ...(location ? { location } : {}),
        clientSignals,
      }),
    });

    return (await response.json()) as AppreciationResult;
  };

  let result = await postAppreciation();
  if (result.requiresCaptcha) {
    const turnstileToken = await executeTurnstile();
    result = await postAppreciation(turnstileToken);
  }

  return result as AppreciationResult;
}

/**
 * React hook for sending appreciations with optimistic updates.
 */
export function useAppreciation() {
  const authToken = useAuthToken();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appreciate = useCallback(
    async (
      eventId: string,
      teamId: string,
      onSuccess?: (result: AppreciationResult) => void,
      onError?: (error: string) => void,
      options: AppreciationOptions = {},
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await sendAppreciation(
          eventId,
          teamId,
          options,
          authToken,
        );

        if (result.success) {
          onSuccess?.(result);
        } else {
          const errorMsg = result.error || "Failed to send appreciation";
          setError(errorMsg);
          onError?.(errorMsg);
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Network error";
        setError(errorMsg);
        onError?.(errorMsg);
        return {
          success: false,
          error: errorMsg,
          remainingForTeam: 0,
          remainingTotal: 0,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [authToken],
  );

  return {
    appreciate,
    isAuthenticated: Boolean(authToken),
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
