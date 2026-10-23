import type { ReactNode } from "react";
import type { RecoverableFailure } from "../../lib/operationOutcome";
import { requestSignIn } from "../../lib/signIn";
import "./task-status.css";

/**
 * What we truthfully know about a piece of work. Only show `local` after a
 * storage write succeeded and `saved` after the server confirmed.
 */
export type TaskSaveState =
  | "clean"
  | "unsaved"
  | "local"
  | "local-unavailable"
  | "saving"
  | "saved"
  | "rejected"
  | "unknown";

const STATUS_COPY: Record<Exclude<TaskSaveState, "clean">, string> = {
  unsaved: "Unsaved changes",
  local: "Draft saved on this device",
  "local-unavailable": "Not saved on this device. Keep this tab open until you submit.",
  saving: "Saving to HackJudge…",
  saved: "Saved to HackJudge",
  rejected: "Save rejected; your changes are kept",
  unknown: "Connection interrupted; checking whether this saved",
};

/** Small persistent status line placed near a form's primary action. */
export function TaskStatus({ state, label }: { state: TaskSaveState; label?: string }) {
  if (state === "clean") return null;
  const tone =
    state === "rejected" || state === "local-unavailable" || state === "unknown"
      ? "warning"
      : state === "saved"
        ? "success"
        : "neutral";
  return (
    <p className="task-status" data-tone={tone} role="status" aria-live="polite">
      <span className="task-status-dot" aria-hidden="true" />
      {label ?? STATUS_COPY[state]}
    </p>
  );
}

/**
 * Persistent inline failure beside the task. Unlike a toast it stays until the
 * user retries or the work succeeds, and it carries a support reference.
 */
export function InlineFailure({
  failure,
  title,
  children,
  onRetry,
  retryLabel = "Try again",
  busy = false,
  onDismiss,
}: {
  failure?: RecoverableFailure | null;
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  busy?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div className="inline-failure" role="alert">
      <p className="inline-failure-title">{title}</p>
      {failure && <p className="inline-failure-body">{failure.message}</p>}
      {children}
      {(onRetry || onDismiss || failure) && (
        <div className="inline-failure-actions">
          {/* An expired session can't be fixed by retrying; offer sign-in first. Drafts survive the redirect. */}
          {failure?.category === "authentication" && (
            <button type="button" className="fi-transport" onClick={requestSignIn}>
              Sign in again
            </button>
          )}
          {onRetry && failure?.category !== "authentication" && (
            <button type="button" className="fi-key" onClick={onRetry} disabled={busy}>
              {busy ? "Trying again…" : retryLabel}
            </button>
          )}
          {onDismiss && (
            <button type="button" className="inline-failure-dismiss" onClick={onDismiss}>
              Dismiss
            </button>
          )}
          {failure && <span className="inline-failure-ref">Ref {failure.reference}</span>}
        </div>
      )}
    </div>
  );
}
