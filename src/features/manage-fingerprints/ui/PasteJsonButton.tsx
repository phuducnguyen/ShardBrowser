import { Icon } from "../../../shared/ui/hv";
import { useFingerprint } from "../../../entities/fingerprint";
import { useT } from "../../../shared/i18n";

export function PasteJsonButton() {
  const t = useT();
  const setImporterOpen = useFingerprint((s) => s.setImporterOpen);
  return (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => setImporterOpen(true)}>
      <Icon name="plus" />{t("pasteJsonButton.label")}
    </button>
  );
}
