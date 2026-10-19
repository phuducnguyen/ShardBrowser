import { useEffect, useMemo, useState } from "react";
import { Chips, FormDialog } from "../../../shared/ui/hv";
import { useT } from "../../../shared/i18n";
import { useProxy } from "../../../entities/proxy";

/** Spreads the selected proxies over the chosen profiles, paired by position —
 *  which is why both lists are shown rather than just their counts. */
export function ProxyDistributeModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const proxies = useProxy((s) => s.proxies);
  const proxySel = useProxy((s) => s.proxySel);
  const profiles = useProxy((s) => s.profiles);
  const distribute = useProxy((s) => s.distribute);

  const picked = useMemo(
    () => proxies.filter((p) => proxySel.has(p.id)),
    [proxies, proxySel],
  );

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) if (p.folder) set.add(p.folder);
    return [...set].sort();
  }, [profiles]);

  const [folder, setFolder] = useState("all");
  // Unbound profiles by default: distributing proxies over profiles that
  // already have one is how two of them end up behind the same IP without
  // anyone meaning it. "All profiles" is there for a deliberate re-shuffle.
  const [scope, setScope] = useState<"unbound" | "all">("unbound");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () =>
      profiles.filter(
        (p) =>
          (folder === "all" || p.folder === folder) &&
          (scope === "all" || !p.proxy_id),
      ),
    [profiles, folder, scope],
  );

  // The list is what the filters say; re-pick everything whenever they change
  // rather than leaving a selection the operator can no longer see.
  useEffect(() => {
    setChosen(new Set(candidates.map((p) => p.id)));
  }, [candidates]);

  const targets = candidates.filter((p) => chosen.has(p.id));
  const boundCount = targets.filter((p) => p.proxy_id).length;
  const willBind = Math.min(targets.length, picked.length);

  const run = async () => {
    setBusy(true);
    try { await distribute(targets.map((p) => p.id)); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <FormDialog
      wide
      title={
        picked.length === 1
          ? t("proxyDistributeModal.titleOne")
          : t("proxyDistributeModal.titleMany", { n: picked.length })
      }
      confirmLabel={
        willBind === 0
          ? t("proxyDistributeModal.nothingToBind")
          : t("proxyDistributeModal.bindCount", { n: willBind })
      }
      cancelLabel={t("proxyDistributeModal.cancel")}
      confirmDisabled={busy || willBind === 0}
      initialFocus="#dist-folder"
      onClose={onClose}
      onConfirm={run}
    >
      <div className="row2">
        <div>
          <label className="label" htmlFor="dist-folder">{t("proxyDistributeModal.profilesFrom")}</label>
          <select id="dist-folder" className="select" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="all">{t("proxyDistributeModal.everyFolder")}</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <p className="label">{t("proxyDistributeModal.applyTo")}</p>
          <Chips
            name="dist-scope"
            label={t("proxyDistributeModal.applyTo")}
            value={scope}
            options={[
              { value: "unbound", label: t("proxyDistributeModal.scopeUnbound") },
              { value: "all", label: t("proxyDistributeModal.scopeAll") },
            ]}
            onChange={setScope}
          />
        </div>
      </div>

      {scope === "all" && boundCount > 0 && (
        <p className="callout-warn" role="status">
          {boundCount === 1
            ? t("proxyDistributeModal.replaceWarnOne")
            : t("proxyDistributeModal.replaceWarnMany", { n: boundCount })}
        </p>
      )}

      <div className="dist-cols">
        <div>
          <p className="dist-head">{t("proxyDistributeModal.proxiesCount", { n: picked.length })}</p>
          <div className="dist-list">
            {picked.map((p, i) => (
              <div key={p.id} className={i >= targets.length ? "dist-row is-dim" : "dist-row"}>
                <span className="n mono">{i + 1}</span>
                <span className="nm">{p.name || `${p.host}:${p.port}`}</span>
                {p.country && <span className="cc">{p.country}</span>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="dist-head">
            {t("proxyDistributeModal.profilesCount", { n: targets.length, total: candidates.length })}
          </p>
          <div className="dist-list">
            {candidates.map((p, i) => {
              const on = chosen.has(p.id);
              const beyond = on && i >= picked.length;
              return (
                <label key={p.id} className={beyond ? "dist-row is-dim" : "dist-row"}>
                  <input
                    type="checkbox"
                    className="chk"
                    checked={on}
                    onChange={() => {
                      const next = new Set(chosen);
                      if (on) next.delete(p.id); else next.add(p.id);
                      setChosen(next);
                    }}
                  />
                  <span className="n mono">{i + 1}</span>
                  <span className="nm">{p.name}</span>
                </label>
              );
            })}
            {candidates.length === 0 && <div className="dist-empty">{t("proxyDistributeModal.noMatches")}</div>}
          </div>
        </div>
      </div>

      <p className="hint">{t("proxyDistributeModal.pairingNote")}</p>
    </FormDialog>
  );
}
