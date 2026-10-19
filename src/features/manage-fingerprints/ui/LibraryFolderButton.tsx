import { Icon } from "../../../shared/ui/hv";
import { useFingerprint } from "../../../entities/fingerprint";
import { useT } from "../../../shared/i18n";

export function LibraryFolderButton() {
  const t = useT();
  const openLibraryFolder = useFingerprint((s) => s.openLibraryFolder);
  return (
    <button type="button" className="btn btn-text btn-sm" title={t("libraryFolderButton.tooltip")} onClick={openLibraryFolder}>
      <Icon name="folder" size={18} />{t("libraryFolderButton.label")}
    </button>
  );
}
