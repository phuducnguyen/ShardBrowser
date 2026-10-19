import { Icon } from "../../../shared/ui/hv";
import { useFingerprint } from "../../../entities/fingerprint";
import { useT } from "../../../shared/i18n";

export function ImportFromFileButton() {
  const t = useT();
  const importJsonFile = useFingerprint((s) => s.importJsonFile);
  return (
    <button type="button" className="btn btn-text btn-sm" onClick={importJsonFile}>
      <Icon name="download" size={18} />{t("importFromFileButton.label")}
    </button>
  );
}
