import { useState } from "react";
import { FormDialog, Icon } from "../../../shared/ui/hv";
import { useT } from "../../../shared/i18n";

/// Folder picker/creator dialog (replaces native prompt). mode: "create" | "move".
export function FolderModal({
  mode, existing, onPick, onCreate, onClose,
}: {
  mode: "create" | "move";
  existing: string[];
  onPick: (folder: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const dup = existing.includes(trimmed);
  const showList = mode === "move" && existing.length > 0;
  return (
    <FormDialog
      title={mode === "move" ? t("folderModal.moveTitle") : t("folderModal.createTitle")}
      confirmLabel={showList ? t("folderModal.createAndMove") : t("folderModal.create")}
      cancelLabel={t("folderModal.cancel")}
      confirmDisabled={!trimmed || dup}
      onConfirm={() => onCreate(trimmed)}
      onClose={onClose}
      initialFocus="#fm-name"
    >
      {showList && (
        <>
          <span className="label tight">{t("folderModal.existingFolders")}</span>
          <div className="pick-list">
            {existing.map((f) => (
              <button key={f} type="button" className="pick-item" onClick={() => onPick(f)}>
                <Icon name="folder" size={18} />{f}
              </button>
            ))}
          </div>
          <div className="or-rule">{t("folderModal.orCreateNew")}</div>
        </>
      )}
      <div>
        <label className="label" htmlFor="fm-name">
          {showList ? t("folderModal.newFolderNameLabel") : t("folderModal.folderNameLabel")}
        </label>
        <input
          id="fm-name"
          className="field"
          autoComplete="off"
          value={name}
          placeholder={t("folderModal.namePlaceholder")}
          aria-invalid={dup || undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {dup && <p className="hint is-error" role="alert" style={{ marginTop: 8 }}>{t("folderModal.duplicateError", { name: trimmed })}</p>}
      </div>
    </FormDialog>
  );
}
