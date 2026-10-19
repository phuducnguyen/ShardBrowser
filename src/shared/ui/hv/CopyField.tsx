import { Icon } from "./Icon";
import { clip } from "../../lib/clipboard";
import { toast } from "../../model/toast";
import { useT } from "../../i18n";

/// Read-only value with a copy button next to it. `secret` masks it (a token is shown only to be copied).
export function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const t = useT();
  const copy = async () => {
    try {
      await clip.write(value);
      toast.ok(t("copyField.copied"));
    } catch (e) {
      toast.err(String(e));
    }
  };
  return (
    <div className="copy-row">
      <input className="field" readOnly aria-label={label} type={secret ? "password" : "text"} value={value} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="icon-btn" title={t("copyField.copyTitle")} aria-label={t("copyField.copyTitle")} onClick={copy}>
        <Icon name="copy" size={20} />
      </button>
    </div>
  );
}
