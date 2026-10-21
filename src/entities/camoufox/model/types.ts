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

export type CamoufoxOs = "windows" | "macos" | "linux" | "android";

export type PhoneTier = "high" | "mid" | "low";

/** What a phone adds to a library entry: its class and the Android versions that class could run. */
export type PhoneInfo = {
  name: string;
  dpr: number;
  /** The version in the preset's own user agent. */
  android: number;
  android_min: number;
  android_max: number;
  gpu_vendor: string;
  tier: PhoneTier;
};

/** One recorded Firefox device a Camoufox profile can wear. */
export type CamoufoxDevice = {
  id: string;
  os: CamoufoxOs;
  label: string;
  screen: [number, number];
  cores: number | null;
  gpu: string;
  /** Present for phones only. */
  phone: PhoneInfo | null;
};

export type InstallProgress = {
  phase: "download" | "verify" | "extract";
  percent: number;
  received: number;
  total: number;
};
