import { useState } from "react";
import { toast } from "../../../../shared/model/toast";
import { storeBus } from "../../../../shared/lib/storeBus";
import { useT } from "../../../../shared/i18n";
import { emptyProxy, parseProxyLine, proxySave, type ProxyEntry } from "../../../../entities/proxy";
import { useProfile } from "../../../../entities/profile";
import type { TabProps } from "./types";

const proxyLabel = (p: ProxyEntry) =>
  p.name && p.name !== `${p.host}:${p.port}`
    ? `${p.name} · ${p.host}:${p.port}${p.country ? ` · ${p.country}` : ""}`
    : `${p.host}:${p.port} · ${p.country || p.kind}`;

export function ProxyTab({ f, u }: TabProps) {
  const t = useT();
  const proxies = useProfile((s) => s.proxies);
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = parseProxyLine(line);

  const addAndBind = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const saved = await proxySave({
        ...emptyProxy(),
        name: `${parsed.host}:${parsed.port}`,
        kind: parsed.kind ?? "socks5",
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        password: parsed.password,
      });
      // The Proxies window keeps its own copy of the list; and the select below reads this store's,
      // which has to hold the new proxy before it is chosen.
      storeBus.emit("proxies");
      await useProfile.getState().reload();
      u("proxy_id", saved.id);
      setLine("");
    } catch (e) {
      toast.err(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="group">
        <label className="label" htmlFor="pe-proxy">{t("inlineEditor.proxyLabel")}</label>
        <select id="pe-proxy" className="select" value={f.proxy_id ?? ""} onChange={(e) => u("proxy_id", e.target.value || null)}>
          <option value="">{t("proxySelect.directConnection")}</option>
          {proxies.map((p) => <option key={p.id} value={p.id}>{proxyLabel(p)}</option>)}
        </select>
        {!f.proxy_id && <p className="hint" style={{ marginTop: 8 }}>{t("profileEditor.directHint")}</p>}
      </div>

      <div className="group">
        <label className="label" htmlFor="pe-proxy-line">{t("proxySelect.createNew")}</label>
        <input
          id="pe-proxy-line"
          className="field"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("proxySelect.linePlaceholder")}
          value={line}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && parsed && !busy) { e.preventDefault(); void addAndBind(); } }}
        />
        <p className="hint" style={{ margin: "8px 0 12px" }} role="status">
          {parsed
            ? `${(parsed.kind ?? "socks5").toUpperCase()} ${parsed.host}:${parsed.port}${parsed.username ? ` · ${parsed.username}` : ""}`
            : line.trim() ? t("proxySelect.parseFailed") : t("proxySelect.pasteHint")}
        </p>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!parsed || busy} onClick={() => void addAndBind()}>
          {t("proxySelect.addAndBind")}
        </button>
      </div>
    </>
  );
}
