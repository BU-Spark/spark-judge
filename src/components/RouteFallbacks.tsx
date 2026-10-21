import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ui/ErrorState";

/**
 * Cheap shape check for Convex document IDs taken from a URL. It rejects
 * obviously malformed links before they reach a validator; an ID from the
 * wrong table still passes and is contained by the route boundary.
 */
export function isConvexIdShape(value: string | undefined): value is string {
  return typeof value === "string" && /^[0-9a-z]{1,64}$/.test(value);
}

/**
 * Route-level containment: a failed page keeps the header and offers a retry
 * plus a working destination. Keyed by path so navigating away clears it.
 */
export function RouteBoundary({ children, section }: { children: ReactNode; section?: string }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary
      key={pathname}
      section={section ?? pathname}
      fallback={({ reference, reset }) => <RouteFailure reference={reference} onRetry={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}

function RouteFailure({ reference, onRetry }: { reference: string; onRetry: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const eventPath = pathname.match(/^\/event\/[^/]+/)?.[0];
  const hasDistinctEvent = eventPath && eventPath !== pathname;
  return (
    <ErrorState
      title="This page couldn't load"
      description="Something went wrong on this page. Drafts saved on this device are kept, and the rest of HackJudge still works."
      reference={reference}
      actionLabel="Try again"
      onAction={onRetry}
      secondaryLabel={hasDistinctEvent ? "Back to event" : "Back to events"}
      onSecondaryAction={() => void navigate(hasDistinctEvent ? eventPath : "/")}
    />
  );
}

/** Bounded "link unavailable" page for malformed, obsolete, or missing targets. */
export function UnavailablePage({
  title = "This link isn't available",
  description = "The page may have moved, or the link may be incomplete. Check the address or browse current events.",
  backTo = "/",
  backLabel = "Back to events",
}: {
  title?: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}) {
  const navigate = useNavigate();
  return (
    <ErrorState
      title={title}
      description={description}
      actionLabel={backLabel}
      onAction={() => void navigate(backTo)}
    />
  );
}
