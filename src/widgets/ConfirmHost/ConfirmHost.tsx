import { useEffect, useId, useRef } from "react";
import { useConfirmStore } from "../../shared/model/confirm";
import { useT } from "../../shared/i18n";

/// Global confirm dialog: a native <dialog> fed by the zustand confirm store.
/// No backdrop-dismiss on purpose: a choice that may delete something should be
/// explicit. Esc still cancels, and Cancel is the first button, so it has focus.
export function ConfirmHost() {
  const t = useT();
  const req = useConfirmStore((s) => s.req);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req && !d.open) {
      d.showModal();
      // The first button (Cancel) takes focus, but without the ring: the dialog was opened by a click.
      d.querySelector<HTMLElement>("button")?.focus({ focusVisible: false } as FocusOptions);
    } else if (!req && d.open) d.close();
  }, [req]);

  return (
    <div className="hv" style={{ display: "contents" }}>
      <dialog
        ref={ref}
        className="dialog"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onCancel={(e) => { e.preventDefault(); req?.resolve(null); }}
      >
        {req && (
          <>
            <h2 id={titleId}>{req.title ?? t("confirm.title")}</h2>
            <p id={descId}>{req.message}</p>
            <div className="actions">
              {req.buttons.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  className={b.danger ? "btn btn-danger" : b.primary ? "btn btn-primary btn-sm" : "btn btn-text"}
                  onClick={() => req.resolve(b.value)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
