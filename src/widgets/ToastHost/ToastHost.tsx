import { Icon } from "../../shared/ui/hv";
import { useToastStore } from "../../shared/model/toast";
import { useT } from "../../shared/i18n";

/// Global toast stack fed by the zustand toast store. The live region is always
/// mounted so a screen reader announces the first toast as well as later ones.
export function ToastHost() {
  const t = useT();
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="hv" style={{ display: "contents" }}>
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={item.kind === "err" ? "toast is-error" : "toast"}>
            <span>{item.text}</span>
            <button type="button" aria-label={t("toast.dismiss")} onClick={() => dismiss(item.id)}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
