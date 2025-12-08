/**
 * Demo Day Identity Utilities
 * 
 * Provides attendee identification and device fingerprinting for the
 * Demo Day appreciation system. Handles:
 * - Persistent attendee UUID (localStorage + cookie fallback)
 * - Device fingerprinting via browser characteristics
 * - Session-level memoization for performance
 */

const ATTENDEE_ID_KEY = "demo_day_attendee_id";
const COOKIE_NAME = "demo_day_aid";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

// Session-level cache for fingerprint (computed once per page load)
let cachedFingerprint: string | null = null;

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

/**
 * Set a cookie with the given name, value, and max age
 */
function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  
  // Set cookie with SameSite=Lax for cross-site compatibility
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

/**
 * Get or create a persistent attendee ID.
 * Uses localStorage with cookie fallback for Safari private mode.
 */
export function getAttendeeId(): string {
  if (typeof window === "undefined") {
    // Server-side or non-browser environment
    return generateUUID();
  }

  // Try localStorage first
  try {
    const stored = localStorage.getItem(ATTENDEE_ID_KEY);
    if (stored) {
      // Also ensure cookie is set for fallback
      setCookie(COOKIE_NAME, stored, COOKIE_MAX_AGE);
      return stored;
    }
  } catch {
    // localStorage might be blocked (Safari private mode, etc.)
  }

  // Try cookie fallback
  const cookieId = getCookie(COOKIE_NAME);
  if (cookieId) {
    // Try to persist to localStorage for future
    try {
      localStorage.setItem(ATTENDEE_ID_KEY, cookieId);
    } catch {
      // Ignore localStorage errors
    }
    return cookieId;
  }

  // Generate new ID
  const newId = generateUUID();

  // Persist to both storage mechanisms
  try {
    localStorage.setItem(ATTENDEE_ID_KEY, newId);
  } catch {
    // Ignore localStorage errors
  }
  setCookie(COOKIE_NAME, newId, COOKIE_MAX_AGE);

  return newId;
}

/**
 * Collect browser characteristics for fingerprinting.
 * Returns a consistent object that can be hashed.
 */
function collectFingerprintData(): Record<string, unknown> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { fallback: true, timestamp: Date.now() };
  }

  return {
    ua: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: Array.from(navigator.languages || []),
    screen: [window.screen.width, window.screen.height],
    dpr: window.devicePixelRatio,
    cores: navigator.hardwareConcurrency || 0,
    tz: new Date().getTimezoneOffset(),
    // Additional entropy sources
    colorDepth: window.screen.colorDepth,
    touchPoints: navigator.maxTouchPoints || 0,
  };
}

/**
 * Hash a string using SHA-256.
 * Returns a hex string.
 */
async function sha256(message: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Fallback for environments without SubtleCrypto
    // Use a simple hash (not cryptographically secure, but sufficient for fingerprinting)
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a device fingerprint hash.
 * Memoized per session for performance.
 */
export async function getFingerprint(): Promise<string> {
  // Return cached value if available
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  const data = collectFingerprintData();
  const jsonString = JSON.stringify(data);
  const hash = await sha256(jsonString);

  // Cache for this session
  cachedFingerprint = hash;

  return hash;
}

/**
 * Clear the cached fingerprint (useful for testing).
 */
export function clearFingerprintCache(): void {
  cachedFingerprint = null;
}

/**
 * Get both attendee ID and fingerprint in one call.
 * Convenience function for appreciation requests.
 */
export async function getIdentity(): Promise<{
  attendeeId: string;
  fingerprintKey: string;
}> {
  const [attendeeId, fingerprintKey] = await Promise.all([
    Promise.resolve(getAttendeeId()),
    getFingerprint(),
  ]);

  return { attendeeId, fingerprintKey };
}

/**
 * React hook for Demo Day identity.
 * Returns identity data with loading state.
 */
import { useState, useEffect } from "react";

export function useAttendeeIdentity(): {
  attendeeId: string | null;
  fingerprintKey: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [attendeeId, setAttendeeId] = useState<string | null>(null);
  const [fingerprintKey, setFingerprintKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadIdentity() {
      try {
        const identity = await getIdentity();
        if (mounted) {
          setAttendeeId(identity.attendeeId);
          setFingerprintKey(identity.fingerprintKey);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Failed to load identity"));
          setIsLoading(false);
        }
      }
    }

    loadIdentity();

    return () => {
      mounted = false;
    };
  }, []);

  return { attendeeId, fingerprintKey, isLoading, error };
}

/**
 * Check if the current environment supports the identity features.
 */
export function isIdentitySupported(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return false;
  return true;
}

