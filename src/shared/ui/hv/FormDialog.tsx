import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

/// Centered form dialog on a native <dialog> (focus trap, Esc and the backdrop come from the
/// platform). Mount it only while it should be visible; it opens on mount. Enter inside a field
/// submits. Renders its own `.hv` root, so it can sit anywhere in the tree.
export function FormDialog({
  title, onClose, onConfirm, confirmLabel, cancelLabel, confirmDisabled, initialFocus, wide, mid, danger, extra, children,
}: {
  title: string;
  onClose: () => void;
  /// Omit for a pick-only dialog: it then shows just the cancel button.
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel: string;
  confirmDisabled?: boolean;
  /// Selector of the element that takes focus on open (default: the first field).
  initialFocus?: string;
  wide?: boolean;
  /// Between the default and `wide`: for dialogs that carry a paragraph or two.
  mid?: boolean;
  /// Costly confirm: red button, and Enter never fires it (only a deliberate click does).
  danger?: boolean;
  /// Sits at the left end of the button row (e.g. a "don't ask again" checkbox).
  extra?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    d.showModal();
    // With nothing to focus yet (a list still loading) the dialog itself takes focus, so the platform's
    // pick (the Cancel button) does not show a ring for no reason.
    const first = d.querySelector<HTMLElement>(initialFocus ?? "input, textarea, select") ?? d;
    first.focus({ focusVisible: false } as FocusOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the mount matters
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (onConfirm && !confirmDisabled && !danger) onConfirm();
  };

  return (
    <div className="hv" style={{ display: "contents" }}>
      <dialog
        ref={ref}
        className={wide ? "dialog form wide" : mid ? "dialog form mid" : "dialog form"}
        aria-labelledby={titleId}
        tabIndex={-1}
        onClose={onClose}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <form onSubmit={submit}>
          <h2 id={titleId}>{title}</h2>
          <div className="dialog-body">{children}</div>
          <div className="actions">
            {extra && <div className="actions-extra">{extra}</div>}
            <button type="button" className="btn btn-text btn-sm" onClick={onClose}>{cancelLabel}</button>
            {onConfirm && (danger ? (
              <button type="button" className="btn btn-danger btn-sm" disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</button>
            ) : (
              <button type="submit" className="btn btn-primary btn-sm" disabled={confirmDisabled}>{confirmLabel}</button>
            ))}
          </div>
        </form>
      </dialog>
    </div>
  );
}
