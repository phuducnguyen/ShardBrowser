import { useFingerprint, useFingerprintGroups } from "../../entities/fingerprint";
import { useT } from "../../shared/i18n";

/// Secondary navigation of the Fingerprints window: one entry per platform, with counts.
export function PlatformPanel({ active, onPick }: { active: string; onPick: (platform: string) => void }) {
  const t = useT();
  const total = useFingerprint((s) => s.items.length);
  const groups = useFingerprintGroups();
  const items: { id: string; label: string; count: number }[] = [
    { id: "all", label: t("fingerprints.platformAll"), count: total },
    ...groups.map(([name, list]) => ({ id: name, label: name, count: list.length })),
  ];

  return (
    <aside className="panel" aria-label={t("fingerprints.panelPlatform")}>
      <div className="panel-title">{t("fingerprints.panelPlatform")}</div>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={it.id === active ? "nav-item is-active" : "nav-item"}
          aria-current={it.id === active ? "true" : undefined}
          onClick={() => onPick(it.id)}
        >
          {it.label}
          <span className="count">{it.count}</span>
        </button>
      ))}
    </aside>
  );
}
