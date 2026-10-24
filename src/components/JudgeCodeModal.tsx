import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { errorMessage } from "../lib/operationOutcome";
import "./auth/sign-in.css";
import "./JudgeCodeModal.css";

/** Matches the server's JUDGE_CODE_MAX_LENGTH so long codes are never cut off. */
const JUDGE_CODE_INPUT_MAX = 32;

interface JudgeCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  onSuccess: () => void;
}

export function JudgeCodeModal({ isOpen, onClose, eventId, onSuccess }: JudgeCodeModalProps) {
  const [judgeCode, setJudgeCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const joinAsJudge = useMutation(api.events.joinAsJudge);
  const verifyCode = useMutation(api.events.verifyJudgeCodeAndStartJudging);

  const dialog = useRef<HTMLDialogElement>(null);
  const errorId = useId();

  useEffect(() => {
    const node = dialog.current;
    if (!isOpen || !node || node.open) return;
    if (typeof node.showModal === "function") node.showModal();
    else node.setAttribute("open", "");
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!judgeCode.trim()) {
      setError("Enter the judge code");
      return;
    }

    setIsSubmitting(true);
    setError("");

    // Register first so a code-only judge never hits "not registered".
    // joinAsJudge is idempotent and returns the existing seat if present.
    try {
      await joinAsJudge({ eventId });
    } catch (err: any) {
      setError(errorMessage(err, "Could not register as a judge"));
      toast.error("Could not register as a judge");
      setIsSubmitting(false);
      return;
    }

    try {
      // Wrong and locked-out codes come back as a result, not an error, so
      // the server can keep counting failed attempts.
      const result = await verifyCode({ eventId, judgeCode: judgeCode.trim() });
      if (!result.ok) {
        setError(result.message);
        toast.error(result.code === "judge_code_locked" ? "Too many attempts" : "Invalid judge code");
        return;
      }
      toast.success("Code verified — seat assigned");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(errorMessage(err, "Invalid code"));
      toast.error("Invalid judge code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setJudgeCode("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialog}
      className="platform-auth-dialog"
      aria-labelledby="judge-code-title"
      aria-describedby="judge-code-description"
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) handleClose();
      }}
    >
      <div className="platform-auth-content">
        <div className="platform-auth-heading">
          <h2 id="judge-code-title">Enter judge code</h2>
          <button
            type="button"
            className="platform-auth-close"
            aria-label="Close"
            onClick={handleClose}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p id="judge-code-description">
          Use the code from the event desk to start scoring teams.
        </p>

        <form onSubmit={handleSubmit} className="judge-code-form" noValidate>
          <label htmlFor="judgeCode">Code</label>
          <input
            id="judgeCode"
            type="text"
            value={judgeCode}
            onChange={(e) => {
              setJudgeCode(e.target.value.toUpperCase().slice(0, JUDGE_CODE_INPUT_MAX));
              setError("");
            }}
            className="judge-code-input"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={JUDGE_CODE_INPUT_MAX}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p id={errorId} className="judge-code-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className="judge-code-submit">
            {isSubmitting ? (
              <>
                <span className="judge-code-spinner" aria-hidden="true" />
                Verifying
              </>
            ) : (
              "Verify & start judging"
            )}
          </button>
        </form>
      </div>
    </dialog>
  );
}
