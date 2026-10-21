import { useEffect } from "react";
import { useT } from "../../../shared/i18n";
import { useCamoufox } from "../../../entities/camoufox";

const gb = (n: number | null | undefined) => (n == null ? "" : `${(n / 1e9).toFixed(1)} GB`);

/// The Camoufox engine as a person sees it: not installed (with the size to download and an Install
/// button that shows progress), or installed (version and size on disk). Used in Settings and as a
/// reminder inside the profile editor.
export function CamoufoxEngineCard() {
  const t = useT();
  const status = useCamoufox((s) => s.status);
  const installing = useCamoufox((s) => s.installing);
  const progress = useCamoufox((s) => s.progress);
  const install = useCamoufox((s) => s.install);

  useEffect(() => {
    if (!useCamoufox.getState().status) void useCamoufox.getState().load();
  }, []);

  if (!status) return null;
  if (!status.supported) {
    return <p className="hint" role="status">{t("camoufox.unsupported")}</p>;
  }

  const phaseText = progress
    ? progress.phase === "download" ? t("camoufox.phaseDownload", { percent: progress.percent })
      : progress.phase === "verify" ? t("camoufox.phaseVerify")
      : t("camoufox.phaseExtract")
    : t("camoufox.installing");

  return (
    <div className="engine-card">
      <p className="hint" role="status">
        {status.installed
          ? t("camoufox.installed", { version: status.version, size: gb(status.size_bytes) })
          : t("camoufox.notInstalled", { size: gb(status.download_bytes) })}
      </p>
      {installing && (
        <div className="engine-progress">
          <progress max={100} value={progress?.phase === "download" ? progress.percent : undefined} aria-label={phaseText} />
          <span className="hint tight">{phaseText}</span>
        </div>
      )}
      <button type="button" className={status.installed ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"} disabled={installing} onClick={() => void install(status.installed)}>
        {installing ? t("camoufox.installing") : status.installed ? t("camoufox.reinstall") : t("camoufox.install")}
      </button>
    </div>
  );
}
