import { Icon } from "../../../shared/ui/hv";
import { useFingerprint, type FingerprintEntry } from "../../../entities/fingerprint";
import { useT } from "../../../shared/i18n";

export function FingerprintCardActions({ entry }: { entry: FingerprintEntry }) {
  const t = useT();
  const useTemplate = useFingerprint((s) => s.useTemplate);
  const remove = useFingerprint((s) => s.remove);

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => useTemplate(entry.id)}>
        {t("fingerprintCardActions.use")}
      </button>
      {entry.builtin ? (
        <span className="chip-plain push">{t("fingerprintCardActions.builtin")}</span>
      ) : (
        <button
          type="button"
          className="icon-btn push"
          title={t("fingerprintCardActions.removeTitle")}
          aria-label={t("fingerprintCardActions.removeTitle")}
          onClick={() => remove(entry.id)}
        >
          <Icon name="trash" size={18} />
        </button>
      )}
    </>
  );
}
