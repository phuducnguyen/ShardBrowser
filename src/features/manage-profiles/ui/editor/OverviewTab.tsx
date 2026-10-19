import { Swatches } from "../../../../shared/ui/hv";
import { PROFILE_COLORS } from "../../../../shared/ui/ColorSwatches";
import { useT } from "../../../../shared/i18n";
import type { GpuPicker } from "../../lib/useGpuPicker";
import { DeviceSection } from "./DeviceSection";
import type { TabProps } from "./types";

export function OverviewTab({ f, u, gpu }: TabProps & { gpu: GpuPicker }) {
  const t = useT();
  return (
    <>
      <DeviceSection f={f} u={u} gpu={gpu} />

      <div className="group">
        <p className="label" id="pe-color-label">{t("inlineEditor.colorLabel")}</p>
        <Swatches
          label={t("inlineEditor.colorLabel")}
          value={f.color}
          colors={PROFILE_COLORS}
          autoLabel={t("colorSwatches.autoTitle")}
          onChange={(v) => u("color", v)}
        />
      </div>

      <div className="group">
        <label className="label" htmlFor="pe-notes">{t("inlineEditor.notesLabel")}</label>
        <textarea
          id="pe-notes"
          className="field"
          placeholder={t("inlineEditor.notesPlaceholder")}
          value={f.notes}
          onChange={(e) => u("notes", e.target.value)}
        />
      </div>
    </>
  );
}
