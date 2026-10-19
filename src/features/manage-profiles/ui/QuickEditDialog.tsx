import { useState } from "react";
import { FormDialog } from "../../../shared/ui/hv";
import { toast } from "../../../shared/model/toast";
import { useT } from "../../../shared/i18n";
import type { ProfileMeta } from "../../../entities/profile";
import type { ProxyEntry } from "../../../entities/proxy";
import { profileBindProxy, profileGet, profileSave } from "../../../entities/profile";

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

  const saveProxy = async () => {
    try {
      await profileBindProxy(profile.id, proxyId);
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
      onClose={onClose}
    >
      {kind === "proxy" ? (
        <div>
          <label className="label" htmlFor="qe-proxy">{t("quickEditDialog.proxyLabel")}</label>
          <select id="qe-proxy" className="select" value={proxyId ?? ""} onChange={(e) => setProxyId(e.target.value || null)}>
            <option value="">{t("quickEditDialog.directConnection")}</option>
            {proxies.map((px) => (
              <option key={px.id} value={px.id}>
                {`${px.name || `${px.host}:${px.port}`} · ${px.country || px.kind}`}
              </option>
            ))}
          </select>
        </div>
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
