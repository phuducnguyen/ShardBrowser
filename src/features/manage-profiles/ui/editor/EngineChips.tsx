import { Chips } from "../../../../shared/ui/hv";
import { useT } from "../../../../shared/i18n";
import { useCamoufox } from "../../../../entities/camoufox";
import type { ProfileForm } from "../../../../entities/profile";
import type { Update } from "./types";

/// Which engine runs the profile. Chosen while creating; an existing profile keeps the one it has,
/// because its data folder and fingerprint belong to that engine.
export function EngineChips({ f, u }: { f: ProfileForm; u: Update }) {
  const t = useT();
  const status = useCamoufox((s) => s.status);
  const isNew = !f.id;
  // Unknown (no answer yet) counts as available; the card below says if it is not installed.
  const available = status?.supported !== false;
  return (
    <div className="group">
      <h2 className="sect">{t("deviceSection.engineLabel")}</h2>
      <Chips
        name="profile-engine"
        label={t("deviceSection.engineLabel")}
        value={f.engine}
        options={[
          { value: "chrome", label: t("deviceSection.engineChrome"), disabled: !isNew && f.engine !== "chrome" },
          {
            value: "camoufox",
            label: t("deviceSection.engineCamoufox"),
            disabled: (!isNew && f.engine !== "camoufox") || !available,
            hint: !available ? t("camoufox.unsupportedHint") : undefined,
          },
        ]}
        onChange={(v) => u("engine", v)}
      />
      {!isNew && <p className="hint tight">{t("camoufox.engineFixed")}</p>}
    </div>
  );
}
