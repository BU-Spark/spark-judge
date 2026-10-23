import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { errorMessage } from "../lib/operationOutcome";
import "./JudgeCodeModal.fi.css";

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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!judgeCode.trim()) {
      setError("Enter the 6-character code");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "color-mix(in srgb, var(--fi-ink) 55%, transparent)" }}
        onClick={handleClose}
      />
      <div className="fi-panel fi-jc-card relative slide-up" role="dialog" aria-modal="true" aria-labelledby="fi-jc-title">
        <button
          type="button"
          onClick={handleClose}
          className="fi-key fi-key--sm absolute top-4 right-4"
          aria-label="Close"
        >
          Esc
        </button>

        <p className="fi-engraved" style={{ marginBottom: "0.5rem" }}>
          Judge access
        </p>
        <h2 id="fi-jc-title" className="fi-zone" style={{ marginBottom: "0.375rem" }}>
          Enter judge code
        </h2>
        <p className="fi-jc-hint">
          The 6-character code from the event desk unlocks your scoring seat.
        </p>

        <form onSubmit={handleSubmit} className="fi-jc-form">
          <div className={`fi-jc-screen${error ? " fi-jc-screen--error" : ""}`}>
            <label htmlFor="judgeCode" className="fi-engraved-sm fi-jc-screen-tag">
              Code
            </label>
            <input
              id="judgeCode"
              type="text"
              value={judgeCode}
              onChange={(e) => {
                setJudgeCode(e.target.value.toUpperCase().slice(0, JUDGE_CODE_INPUT_MAX));
                setError("");
              }}
              placeholder="······"
              className="fi-jc-input"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={JUDGE_CODE_INPUT_MAX}
            />
          </div>
          {error && <p className="fi-jc-error">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="fi-transport fi-jc-submit">
            {isSubmitting ? (
              <span className="fi-jc-spinner-wrap">
                <span className="fi-jc-spinner" />
                Verifying
              </span>
            ) : (
              "Verify & start judging"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
