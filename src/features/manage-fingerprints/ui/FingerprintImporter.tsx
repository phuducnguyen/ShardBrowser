import { useState } from "react";
import { FormDialog } from "../../../shared/ui/hv";
import { toast } from "../../../shared/model/toast";
import { fingerprintImport } from "../../../entities/fingerprint";
import { useT } from "../../../shared/i18n";

export function FingerprintImporter({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const e = await fingerprintImport(text, name || null);
      toast.ok(t("fingerprintImporter.imported", { name: e.label }));
      onClose();
    } catch (e) {
      toast.err(String(e));
      setBusy(false);
    }
  };
  return (
    <FormDialog
      wide
      title={t("fingerprintImporter.title")}
      confirmLabel={t("fingerprintImporter.confirm")}
      cancelLabel={t("fingerprintImporter.cancel")}
      confirmDisabled={busy || !text.trim()}
      initialFocus="#fi-json"
      onClose={onClose}
      onConfirm={save}
    >
      <div>
        <label className="label" htmlFor="fi-name">{t("fingerprintImporter.nameLabel")}</label>
        <input
          id="fi-name"
          className="field"
          autoComplete="off"
          value={name}
          placeholder={t("fingerprintImporter.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="fi-json">{t("fingerprintImporter.jsonLabel")}</label>
        <textarea
          id="fi-json"
          className="field mono-area"
          rows={14}
          spellCheck={false}
          value={text}
          placeholder='{ "name": "...", "navigator": { ... }, "webgl": { ... }, ... }'
          onChange={(e) => setText(e.target.value)}
        />
      </div>
    </FormDialog>
  );
}
