/**
 * Demo Day API Client
 * 
 * Handles API calls to the Demo Day appreciation endpoints.
 */

import { getIdentity } from "./demoDayIdentity";

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
  remainingForTeam: number;
  remainingTotal: number;
}

/**
 * Send an appreciation to a team via the HTTP endpoint.
 * This uses the HTTP endpoint to capture accurate IP/UA metadata.
 */
export async function sendAppreciation(
  eventId: string,
  teamId: string
): Promise<AppreciationResult> {
  // Get identity data
  const { attendeeId, fingerprintKey } = await getIdentity();

  const baseUrl = getConvexSiteUrl();
  const url = `${baseUrl}/demo-day/appreciations`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      teamId,
      attendeeId,
      fingerprintKey,
    }),
  });

  const result = await response.json();
  return result as AppreciationResult;
}

/**
 * React hook for sending appreciations with optimistic updates.
 */
import { useState, useCallback } from "react";

export function useAppreciation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appreciate = useCallback(
    async (
      eventId: string,
      teamId: string,
      onSuccess?: (result: AppreciationResult) => void,
      onError?: (error: string) => void
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await sendAppreciation(eventId, teamId);

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
    []
  );

  return {
    appreciate,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

