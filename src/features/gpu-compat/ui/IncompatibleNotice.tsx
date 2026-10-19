import { useState } from "react";
import { FormDialog } from "../../../shared/ui/hv";
import { useGpuCompat } from "../../../shared/model/gpuCompat";
import { useT } from "../../../shared/i18n";
import type { GpuCompat } from "../../../entities/fingerprint/model/types";

/// The one text that explains an incompatible fingerprint, used by both the
/// badge and the warning dialog — so the operator reads the same reason
/// wherever they meet it.
export function IncompatibleExplainer({ compat }: { compat: GpuCompat }) {
  const t = useT();
  const caps = useGpuCompat((s) => s.caps);
  const missing = [...compat.missing_webgl1, ...compat.missing_webgl2];
  const unique = Array.from(new Set(missing));
  const gpuMissing = Array.from(new Set(compat.missing_webgpu ?? []));
  return (
    <div className="explain">
      <p>
        {t("incompatibleNotice.claimsIntro")}
        {missing.length > 0 ? t("incompatibleNotice.webglExtensionsPart") : ""}
        {missing.length > 0 && gpuMissing.length > 0 ? t("incompatibleNotice.andPart") : ""}
        {gpuMissing.length > 0 ? t("incompatibleNotice.webgpuFeaturesPart") : ""}
        {" "}{t("incompatibleNotice.claimsOutro")}
      </p>
      <div className="box">
        <div>
          <span className="soft">{t("incompatibleNotice.profileClaims")}</span>{" "}
          <strong>{compat.profile_renderer || "—"}</strong>
        </div>
        <div>
          <span className="soft">{t("incompatibleNotice.thisMachineHas")}</span>{" "}
          <strong>{caps?.renderer || t("incompatibleNotice.unknownRenderer")}</strong>
        </div>
      </div>
      <p>{t("incompatibleNotice.reportsListNote")}</p>
      <pre className="box">
{`gl.getSupportedExtensions()
  -> [ ..., "${unique[0] ?? "WEBGL_compressed_texture_astc"}", ... ]

gl.getExtension("${unique[0] ?? "WEBGL_compressed_texture_astc"}")
  -> null`}
      </pre>
      <p>{t("incompatibleNotice.contradictionNote")}</p>
      <div>
        <div className="soft small">
          {unique.length === 1
            ? t("incompatibleNotice.extensionsUnbackedOne", { n: unique.length })
            : t("incompatibleNotice.extensionsUnbackedMany", { n: unique.length })}
        </div>
        <div className="box list">
          {unique.map((e) => <div key={e}>{e}</div>)}
        </div>
      </div>
      {gpuMissing.length > 0 && (
        <div>
          <div className="soft small">
            {gpuMissing.length === 1
              ? t("incompatibleNotice.webgpuUnbackedOne", { n: gpuMissing.length })
              : t("incompatibleNotice.webgpuUnbackedMany", { n: gpuMissing.length })}
          </div>
          <div className="box list">
            {gpuMissing.map((f) => <div key={f}>{f}</div>)}
          </div>
          <p className="soft small">{t("incompatibleNotice.webgpuNote")}</p>
        </div>
      )}
      <p className="soft">{t("incompatibleNotice.advice")}</p>
    </div>
  );
}

/// The badge shown next to an incompatible fingerprint. Clicking it opens the
/// explanation above; it is not a tooltip, because the reason is longer than a
/// tooltip should be and the operator needs to be able to read it slowly.
export function IncompatibleBadge({ compat }: { compat: GpuCompat }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (compat.compatible) return null;
  return (
    <>
      {/* The badge may sit in a `.hv` page or a legacy one, so it carries its own root. */}
      <span className="hv" style={{ display: "contents" }}>
        <button
          type="button"
          className="chip-warn chip-btn"
          title={t("incompatibleNotice.badgeTitle")}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {t("incompatibleNotice.badgeLabel")}
        </button>
      </span>
      {open && (
        <FormDialog
          mid
          title={t("incompatibleNotice.badgeModalTitle")}
          cancelLabel={t("incompatibleNotice.closeButton")}
          onClose={() => setOpen(false)}
        >
          <IncompatibleExplainer compat={compat} />
        </FormDialog>
      )}
    </>
  );
}

/// Shown when the operator picks an incompatible fingerprint by hand. It does
/// not refuse — the choice is theirs and there are legitimate reasons for it
/// (testing, a profile meant for another machine) — it makes sure the cost is
/// known before it is paid.
export function IncompatibleWarningModal({
  compat,
  onKeep,
  onCancel,
}: {
  compat: GpuCompat;
  onKeep: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [dontWarn, setDontWarn] = useState(false);
  const setSuppressed = useGpuCompat((s) => s.setSuppressed);
  const keep = () => {
    if (dontWarn) setSuppressed(true);
    onKeep();
  };
  return (
    <FormDialog
      mid
      danger
      title={t("incompatibleNotice.warningModalTitle")}
      confirmLabel={t("incompatibleNotice.useAnyway")}
      cancelLabel={t("incompatibleNotice.pickAnother")}
      initialFocus=".actions .btn-text"
      onClose={onCancel}
      onConfirm={keep}
      extra={
        <label className="check-line">
          <input type="checkbox" className="chk" checked={dontWarn} onChange={(e) => setDontWarn(e.target.checked)} />
          <span>{t("incompatibleNotice.dontWarnAgain")}</span>
        </label>
      }
    >
      <IncompatibleExplainer compat={compat} />
    </FormDialog>
  );
}
