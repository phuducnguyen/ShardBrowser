import { useState } from "react";
import { FormDialog } from "../../../shared/ui/hv";
import { toast } from "../../../shared/model/toast";
import { useT } from "../../../shared/i18n";
import type { ProfileMeta } from "../../../entities/profile";
import { emptyProxy, parseProxyLine, proxySave, type ProxyEntry } from "../../../entities/proxy";
import { storeBus } from "../../../shared/lib/storeBus";
import { profileBindProxy, profileGet, profileSave } from "../../../entities/profile";

/// The line a proxy is copied as, and pasted back from: `scheme://user:pass@host:port`.
const proxyLine = (p: ProxyEntry) =>
  `${p.kind}://${p.username ? `${p.username}${p.password ? `:${p.password}` : ""}@` : ""}${p.host}:${p.port}`;

export function QuickEditDialog({
  kind, profile, proxies, onClose, onSaved,
}: {
  kind: "proxy" | "notes";
  profile: ProfileMeta;
  proxies: ProxyEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [proxyId, setProxyId] = useState<string | null>(profile.proxy_id);
  const [notes, setNotes] = useState(profile.notes);

  const [line, setLine] = useState("");
  const parsed = parseProxyLine(line);
  const lineInvalid = line.trim() !== "" && !parsed;
  const current = proxies.find((px) => px.id === proxyId) ?? null;

  const copyCurrent = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(proxyLine(current));
      toast.ok(t("quickEditDialog.proxyCopied"));
    } catch (e) { toast.err(String(e)); }
  };

  /// A pasted proxy that is already in the pool is reused; otherwise it is added first.
  const resolvePasted = async (p: NonNullable<typeof parsed>): Promise<string> => {
    const kind = p.kind ?? "socks5";
    const same = proxies.find((px) =>
      px.host === p.host && px.port === p.port && px.kind === kind && px.username === p.username && px.password === p.password);
    if (same) return same.id;
    const saved = await proxySave({
      ...emptyProxy(), name: `${p.host}:${p.port}`, kind, host: p.host, port: p.port, username: p.username, password: p.password,
    });
    storeBus.emit("proxies");
    return saved.id;
  };

  const saveProxy = async () => {
    try {
      const target = parsed ? await resolvePasted(parsed) : proxyId;
      await profileBindProxy(profile.id, target);
      toast.ok(t("quickEditDialog.proxyUpdated"));
      onSaved();
    } catch (e) { toast.err(String(e)); }
  };

  const saveNotes = async () => {
    try {
      // Round-trip the whole profile JSON so the user's other fields stay intact.
      const stored = await profileGet(profile.id);
      stored.notes = notes;
      await profileSave(stored);
      toast.ok(t("quickEditDialog.notesSaved"));
      onSaved();
    } catch (e) { toast.err(String(e)); }
  };

  return (
    <FormDialog
      title={kind === "proxy"
        ? t("quickEditDialog.bindProxyTitle", { name: profile.name })
        : t("quickEditDialog.editNotesTitle", { name: profile.name })}
      confirmLabel={t("quickEditDialog.save")}
      cancelLabel={t("quickEditDialog.cancel")}
      onConfirm={kind === "proxy" ? () => void saveProxy() : () => void saveNotes()}
      confirmDisabled={kind === "proxy" && lineInvalid}
      onClose={onClose}
    >
      {kind === "proxy" ? (
        <>
          <div>
            <label className="label" htmlFor="qe-proxy">{t("quickEditDialog.proxyLabel")}</label>
            <select
              id="qe-proxy"
              className="select"
              value={proxyId ?? ""}
              onChange={(e) => { setProxyId(e.target.value || null); setLine(""); }}
            >
              <option value="">{t("quickEditDialog.directConnection")}</option>
              {proxies.map((px) => (
                <option key={px.id} value={px.id}>
                  {`${px.name || `${px.host}:${px.port}`} · ${px.country || px.kind}`}
                </option>
              ))}
            </select>
            {current && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => void copyCurrent()}>
                {t("quickEditDialog.copyProxy")}
              </button>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="label" htmlFor="qe-proxy-line">{t("quickEditDialog.pasteLabel")}</label>
            <input
              id="qe-proxy-line"
              className="field"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("proxySelect.linePlaceholder")}
              aria-invalid={lineInvalid || undefined}
              value={line}
              onChange={(e) => setLine(e.target.value)}
            />
            <p className="hint" style={{ marginTop: 8 }} role="status">
              {parsed
                ? t("quickEditDialog.pasteWillUse", { proxy: `${(parsed.kind ?? "socks5").toUpperCase()} ${parsed.host}:${parsed.port}${parsed.username ? ` · ${parsed.username}` : ""}` })
                : lineInvalid ? t("proxySelect.parseFailed") : t("proxySelect.pasteHint")}
            </p>
          </div>
        </>
      ) : (
        <div>
          <label className="label" htmlFor="qe-notes">{t("quickEditDialog.notesLabel")}</label>
          <textarea
            id="qe-notes"
            className="field"
            rows={6}
            style={{ height: "auto", padding: "12px 16px", resize: "vertical" }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}
    </FormDialog>
  );
}
