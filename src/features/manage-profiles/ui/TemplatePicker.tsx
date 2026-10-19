import { useEffect, useState } from "react";
import { FormDialog } from "../../../shared/ui/hv";
import type { FingerprintEntry } from "../../../entities/fingerprint";
import { fingerprintList } from "../../../entities/fingerprint";
import { hostPlatform } from "../../../entities/profile";
import { useGpuCompat } from "../../../shared/model/gpuCompat";
import { useT } from "../../../shared/i18n";

export function TemplatePicker({
  fingerprints,
  onPick,
  onClose,
}: {
  /** When passed in, skip the fingerprint_list IO and the visible mount
   *  flash that used to happen while the 170-entry list streamed back. */
  fingerprints?: FingerprintEntry[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [lib, setLib] = useState<FingerprintEntry[]>(fingerprints ?? []);
  const [host, setHost] = useState<string>("");
  useEffect(() => {
    if (!fingerprints) {
      fingerprintList().then(setLib).catch(() => {});
    }
    hostPlatform().then(setHost).catch(() => {});
  }, [fingerprints]);
  // Only host-matching fingerprints (UA/fonts/WebGL renderer are host-coupled).
  const tpls = host ? lib.filter((e) => e.platform === host) : [];
  // Verdicts for the badge. Loading here as well as in the editor is
  // deliberate: whichever the operator opens first pays for the probe, and the
  // store makes the second one free.
  const compatById = useGpuCompat((st) => st.byId);
  const loadCompat = useGpuCompat((st) => st.load);
  useEffect(() => { void loadCompat(); }, [loadCompat]);

  return (
    <FormDialog
      wide
      title={t("templatePicker.title", { os: host })}
      cancelLabel={t("templatePicker.cancel")}
      onClose={onClose}
      initialFocus=".tpl"
    >
      {tpls.length === 0 ? (
        <p className="hint">{t("templatePicker.empty", { os: host })}</p>
      ) : (
        <div className="tpl-grid">
          {tpls.map((tpl) => (
            <button key={tpl.id} type="button" className="tpl" onClick={() => onPick(tpl.id)}>
              <span className="tpl-bar" style={{ background: tpl.tag_color }} />
              <span className="tpl-top">
                <span className="os">{tpl.platform}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {compatById[tpl.id] && !compatById[tpl.id].compatible && (
                    <span className="chip-warn" title={t("profileEditor.gpuIncompatible")}>{t("incompatibleNotice.badgeLabel")}</span>
                  )}
                  Chrome {tpl.chrome}
                </span>
              </span>
              <span className="tpl-name">{tpl.label}</span>
              <span className="tpl-gpu">{tpl.gpu}</span>
            </button>
          ))}
        </div>
      )}
    </FormDialog>
  );
}
