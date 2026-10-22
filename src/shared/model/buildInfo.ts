import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

/// Which HeroV build is running (from the backend's `app_build_info`).
export type BuildInfo = {
  /// SemVer, e.g. "0.2.0-beta.1".
  version: string;
  /// Short commit hash; ends in "+dirty" for a build from uncommitted changes.
  commit: string;
  /// Seconds since 1970-01-01 UTC.
  built_unix: number;
  /// "stable", "beta", "alpha" or "rc".
  channel: string;
  /// Upstream engine contract this launcher keeps (not HeroV's own version).
  engine_compat: string;
};

type State = {
  info: BuildInfo | null;
  load: () => Promise<void>;
  /// Set by the rail's version chip so Settings opens on its About tab.
  aboutRequested: boolean;
  requestAbout: (on: boolean) => void;
};

export const useBuildInfo = create<State>((set, get) => ({
  info: null,
  aboutRequested: false,
  requestAbout: (on) => set({ aboutRequested: on }),
  load: async () => {
    if (get().info) return;
    try {
      set({ info: await invoke<BuildInfo>("app_build_info") });
    } catch {
      // No backend (plain-browser preview): nothing to show.
    }
  },
}));

/// "v0.2.0-beta.1".
export const versionTag = (b: BuildInfo) => `v${b.version}`;

/// The build date in the reader's language, e.g. "22/10/2026".
export const buildDate = (b: BuildInfo, locale?: string) =>
  b.built_unix > 0 ? new Date(b.built_unix * 1000).toLocaleDateString(locale) : "—";

/// One line to paste into a bug report.
export const buildLine = (b: BuildInfo) =>
  `HeroV Browser ${b.version} (${b.channel}) · commit ${b.commit} · built ${b.built_unix > 0 ? new Date(b.built_unix * 1000).toISOString() : "?"} · engine contract ${b.engine_compat}`;
