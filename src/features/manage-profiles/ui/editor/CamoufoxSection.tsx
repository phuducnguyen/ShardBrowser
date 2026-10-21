import { useEffect, useMemo, useState } from "react";
import { Chips, Icon } from "../../../../shared/ui/hv";
import { useT } from "../../../../shared/i18n";
import { useCamoufox, type CamoufoxOs } from "../../../../entities/camoufox";
import { EngineChips } from "./EngineChips";
import { CamoufoxEngineCard } from "../CamoufoxEngineCard";
import type { TabProps } from "./types";

const OS_LABEL: Record<CamoufoxOs, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };

/// Create profile for the Camoufox engine: the OS, a recorded Firefox device, and what a site will
/// see of it. The identity itself is built from the Camoufox library when the profile starts.
export function CamoufoxSection({ f, u, patch }: TabProps) {
  const t = useT();
  const library = useCamoufox((s) => s.library);
  const status = useCamoufox((s) => s.status);
  const isNew = !f.id;
  const cur = library.find((d) => d.id === f.camoufox_preset) ?? null;
  const [os, setOs] = useState<CamoufoxOs>(cur?.os ?? "windows");
  const list = useMemo(() => library.filter((d) => d.os === os), [library, os]);

  // A new profile with no device, or one left over from another OS, gets a random fitting one.
  useEffect(() => {
    if (!isNew || list.length === 0 || list.some((d) => d.id === f.camoufox_preset)) return;
    patch({ camoufox_preset: list[Math.floor(Math.random() * list.length)].id });
  }, [isNew, list, f.camoufox_preset, patch]);

  const random = () => {
    if (list.length === 0) return;
    patch({ camoufox_preset: list[Math.floor(Math.random() * list.length)].id });
  };
  const firefox = status ? /v?(\d+)/.exec(status.version)?.[1] : null;

  return (
    <>
      <EngineChips f={f} u={u} />

      {status && status.supported && !status.installed && (
        <div className="group">
          <CamoufoxEngineCard />
        </div>
      )}

      <div className="group">
        <h2 className="sect">{t("inlineEditor.osLabel")}</h2>
        <Chips
          name="camoufox-os"
          label={t("inlineEditor.osLabel")}
          value={os}
          options={(["windows", "macos", "linux"] as CamoufoxOs[]).map((o) => ({ value: o, label: OS_LABEL[o], disabled: !isNew }))}
          onChange={setOs}
        />
      </div>

      <div className="group">
        <div className="dev-row">
          <div className="dev-pick">
            <label className="label" htmlFor="cf-device">{t("deviceSection.deviceLabel")}</label>
            <select id="cf-device" className="select" disabled={!isNew} value={f.camoufox_preset} onChange={(e) => u("camoufox_preset", e.target.value)}>
              {list.length === 0 && <option value="">{t("camoufox.noDevices")}</option>}
              {list.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={random} disabled={!isNew || list.length === 0}>
            <Icon name="refresh" size={18} />{t("deviceSection.random")}
          </button>
        </div>
        <p className="hint tight">{t("deviceSection.count", { n: list.length })}</p>
      </div>

      {cur && (
        <section className="group" aria-labelledby="cf-see">
          <div className="dev-head">
            <h2 className="sect" id="cf-see">{t("deviceSection.seeTitle")}</h2>
            <span className="chip-plain">{t("deviceSection.locked")}</span>
          </div>
          <dl className="dev-card">
            <div><dt>{t("deviceSection.platform")}</dt><dd>{OS_LABEL[cur.os]} · {t("deviceSection.kindDesktop")}</dd></div>
            <div><dt>{t("deviceSection.browser")}</dt><dd>{firefox ? `Firefox ${firefox}` : "Firefox"}</dd></div>
            <div><dt>{t("deviceSection.screen")}</dt><dd>{cur.screen[0]}×{cur.screen[1]}</dd></div>
            <div><dt>{t("deviceSection.cores")}</dt><dd>{cur.cores ?? "—"}</dd></div>
            <div className="wide"><dt>{t("deviceSection.graphics")}</dt><dd>{t("camoufox.graphicsHost")}</dd></div>
          </dl>
          <p className="hint">{t("camoufox.limits")}</p>
        </section>
      )}
    </>
  );
}
