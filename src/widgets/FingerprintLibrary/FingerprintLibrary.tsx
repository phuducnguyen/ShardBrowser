import { useFingerprint, useFingerprintGroups, FingerprintCard } from "../../entities/fingerprint";
import { FingerprintCardActions } from "../../features/manage-fingerprints";
import { useT } from "../../shared/i18n";

/// Cards grouped by platform; `platform` narrows the view to one group ("all" shows every group).
export function FingerprintLibrary({ platform }: { platform: string }) {
  const t = useT();
  const isEmpty = useFingerprint((s) => s.items.length === 0);
  const groups = useFingerprintGroups().filter(([name]) => platform === "all" || name === platform);

  return (
    <div className="card stack clip">
      <div className="fp-body">
        <p className="hint">
          {t("fingerprints.introPart1")}<strong>{t("fingerprints.gpuWord")}</strong>{t("fingerprints.introPart2")}
        </p>
        {isEmpty ? (
          <div className="empty">{t("fingerprintLibrary.emptyState")}</div>
        ) : groups.map(([name, list]) => (
          <section key={name} aria-label={name}>
            <h2 className="fp-head">{name}<span className="n">{list.length}</span></h2>
            <div className="fp-grid">
              {list.map((e) => (
                <FingerprintCard key={e.id} entry={e} actions={<FingerprintCardActions entry={e} />} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
