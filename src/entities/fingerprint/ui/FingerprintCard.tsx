import type { ReactNode } from "react";
import type { FingerprintEntry } from "../model/types";
import { useGpuCompat, useGpuCompatReady } from "../../../shared/model/gpuCompat";
import { IncompatibleBadge } from "../../../features/gpu-compat";

export function FingerprintCard({ entry, actions }: { entry: FingerprintEntry; actions?: ReactNode }) {
  // undefined while the GPU probe has not answered yet, and on machines where
  // it cannot run at all. Both are "no verdict", and no verdict must not look
  // like a clean one — hence the badge renders only on a definite mismatch.
  useGpuCompatReady();
  const compat = useGpuCompat((s) => s.byId[entry.id]);
  return (
    <div className="fp-card" style={{ borderLeftColor: entry.tag_color ?? "var(--primary)" }}>
      <div className="fp-top">
        <span className="fp-label" title={entry.label}>{entry.label}</span>
        <span className="fp-tags">
          {compat && <IncompatibleBadge compat={compat} />}
          {entry.chrome && <span className="chip-plain">Chrome {entry.chrome}</span>}
        </span>
      </div>
      <div className="fp-gpu" title={entry.gpu}>{entry.gpu || "—"}</div>
      {actions && <div className="fp-foot">{actions}</div>}
    </div>
  );
}
