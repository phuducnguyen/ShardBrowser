export type CamoufoxStatus = {
  /** Whether this system has a Camoufox build to offer at all. */
  supported: boolean;
  installed: boolean;
  /** The release the launcher installs. */
  version: string;
  binary_path: string | null;
  /** Bytes on disk when installed. */
  size_bytes: number | null;
  /** Bytes to download when not installed. */
  download_bytes: number | null;
};

export type CamoufoxOs = "windows" | "macos" | "linux";

/** One recorded Firefox device a Camoufox profile can wear. */
export type CamoufoxDevice = {
  id: string;
  os: CamoufoxOs;
  label: string;
  screen: [number, number];
  cores: number | null;
  gpu: string;
};

export type InstallProgress = {
  phase: "download" | "verify" | "extract";
  percent: number;
  received: number;
  total: number;
};
