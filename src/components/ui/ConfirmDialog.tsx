import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Modal confirmation built on <dialog> so focus trapping and Escape come from
 * the browser. Pass `confirmText` to require typing a phrase (for deletes).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  confirmText,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  confirmText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTyped("");
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  const matches = !confirmText || typed.trim() === confirmText.trim();

  return (
    <dialog
      ref={dialogRef}
      className="admin-confirm"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (matches && !busy) onConfirm();
        }}
      >
        <h2 id={titleId}>{title}</h2>
        {children && <div className="admin-confirm-body">{children}</div>}
        {confirmText && (
          <label htmlFor={inputId} className="admin-search admin-confirm-type">
            Type <strong>{confirmText}</strong> to confirm
            <input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        <div className="admin-confirm-actions">
          <button type="button" className="fi-key" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={tone === "danger" ? "fi-transport admin-danger-button" : "fi-transport"}
            disabled={!matches || busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
