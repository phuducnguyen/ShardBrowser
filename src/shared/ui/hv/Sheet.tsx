import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/// Right-hand task sheet on a native <dialog>: focus trap, Esc and the backdrop
/// come from the platform. Children are only mounted while open, so each opening
/// starts from a clean state. Must render inside a `.hv` ancestor to be styled.
export function Sheet({ open, onClose, title, closeLabel, initialFocus, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  /// Selector of the element that takes focus when the sheet opens. Without it the platform
  /// picks the first control (the close button) and shows a focus ring on it for no reason.
  initialFocus?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>(initialFocus ?? "")?.focus({ focusVisible: false } as FocusOptions);
    } else if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the open transition matters
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {open && (
        <>
          <div className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" aria-label={closeLabel} onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
