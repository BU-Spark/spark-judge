import { useEffect, useRef } from "react";
import { SignInForm } from "../../SignInFormNew";
import "./sign-in.css";

export function SignInDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="platform-auth-dialog"
      aria-labelledby="platform-sign-in-title"
      aria-describedby="platform-sign-in-description"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="platform-auth-content">
        <div className="platform-auth-heading">
          <h2 id="platform-sign-in-title">Sign in</h2>
          <button
            type="button"
            className="platform-auth-close"
            aria-label="Close sign in"
            onClick={onClose}
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
        <p id="platform-sign-in-description">
          Join the voting and judging at HackJudge.
        </p>
        <SignInForm />
      </div>
    </dialog>
  );
}
