import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HOST_OS } from "../../../shared/lib/utils";
import { matchesOs, osIdFor } from "../../../shared/constants";
import { useGpuCompat } from "../../../shared/model/gpuCompat";
import { enrichPicksForPreset, useProfile, type ProfileForm } from "../../../entities/profile";
import { deviceInfo, devicesFor, filterOptions, type FingerprintEntry } from "../../../entities/fingerprint";
import { useProfileDefaults } from "../../../entities/profile-defaults";

/// The monitor this launcher is on, in CSS pixels. Null while it is being asked and on a machine
/// with none; the editor then offers every resolution.
export function useHostScreen(): [number, number] | null {
  const [size, setSize] = useState<[number, number] | null>(null);
  useEffect(() => {
    invoke<[number, number] | null>("host_screen")
      .then((v) => setSize(v ?? null))
      .catch(() => setSize(null));
  }, []);
  return size;
}

/// Everything the editor does around the fingerprint choice: the OS filter, the GPU list for it,
/// snapping an empty or unknown pick to a random fitting GPU, and holding back a pick that this
/// machine cannot back until the operator has seen what it costs. The same behaviour the old
/// inline editor had, moved out of the markup.
export function useGpuPicker(f: ProfileForm, setDraft: (f: ProfileForm) => void, fingerprints: FingerprintEntry[]) {
  const currentFp = fingerprints.find((x) => x.id === f.gpu_preset_id);
  // A new profile starts on the OS of the operator's Profile defaults; an existing one on its fingerprint's.
  const defaults = useProfileDefaults((s) => s.defaults);
  const isNew = !f.id;
  const [osFilter, setOsFilter] = useState<string>(currentFp ? osIdFor(currentFp.platform as string) : isNew ? defaults.os : HOST_OS);
  // Android: brand. Windows: GPU maker. "" = any. Starts from the defaults for a new profile on the default OS.
  const [filter, setFilter] = useState<string>(!currentFp && isNew && osFilter === defaults.os ? defaults.filter : "");
  const devices = useMemo(() => fingerprints.map(deviceInfo), [fingerprints]);
  const gpusForOs = useMemo(() => fingerprints.filter((fp) => matchesOs(fp.platform, osFilter)), [fingerprints, osFilter]);
  const filterValues = useMemo(() => filterOptions(devices, osFilter), [devices, osFilter]);
  /// The devices the operator can choose from: the OS, narrowed by the filter.
  const deviceList = useMemo(() => devicesFor(devices, osFilter, filter), [devices, osFilter, filter]);

  const compatById = useGpuCompat((s) => s.byId);
  const suppressed = useGpuCompat((s) => s.suppressed);
  const loadCompat = useGpuCompat((s) => s.load);
  useEffect(() => { void loadCompat(); }, [loadCompat]);
  // A pick held back until the operator has seen what it costs.
  const [pendingGpu, setPendingGpu] = useState<string | null>(null);

  // Picking a GPU applies its whole fingerprint; `toStored` carries the library payload at save.
  const setGpu = async (id: string) => {
    const fp = fingerprints.find((x) => x.id === id);
    if (!fp) return;
    const nav = fp.payload?.navigator ?? {};
    // Ask Rust for the same hardware and platform-version triplet that save uses.
    let picks: { hardware_concurrency?: number; device_memory?: number; platform_version?: string } = {};
    try { picks = await enrichPicksForPreset(id); } catch { /* fall back to the preset's own navigator values */ }
    // Read the draft now, not before the await: the operator may have typed in the meantime.
    const base = useProfile.getState().draft ?? f;
    setDraft({
      ...base,
      gpu_preset_id: id,
      hardware_concurrency: picks.hardware_concurrency ?? nav.hardware_concurrency ?? base.hardware_concurrency,
      device_memory: picks.device_memory ?? nav.device_memory ?? base.device_memory,
      platform_version: picks.platform_version ?? base.platform_version,
      user_agent: nav.user_agent ?? base.user_agent,
    });
  };

  // Snap an unknown or empty pick to a random GPU of the active OS, from the ones this machine can
  // back: otherwise the page reads an extension in getSupportedExtensions() and null from getExtension().
  const listedIds = useMemo(() => new Set(deviceList.map((d) => d.id)), [deviceList]);
  /// A random device that passes the filter and that this machine can back; `exceptId` is skipped
  /// when something else is available, so "Random device" always changes the device.
  const randomDevice = (exceptId?: string): FingerprintEntry | undefined => {
    const filtered = gpusForOs.filter((g) => listedIds.has(g.id));
    const base = filtered.length > 0 ? filtered : gpusForOs.length > 0 ? gpusForOs : fingerprints;
    const fitting = base.filter((g) => compatById[g.id]?.compatible !== false);
    let pool = fitting.length > 0 ? fitting : base;
    if (exceptId && pool.length > 1) pool = pool.filter((g) => g.id !== exceptId);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  useEffect(() => {
    if (fingerprints.length === 0) return;
    if (fingerprints.some((g) => g.id === f.gpu_preset_id)) return;
    // A new profile on the default OS with a pinned device in the defaults starts on that device.
    const pinned = isNew && defaults.mode === "pinned" && osFilter === defaults.os
      ? fingerprints.find((g) => g.id === defaults.pinnedId && matchesOs(g.platform, osFilter))
      : undefined;
    const pick = pinned ?? randomDevice();
    if (pick) void setGpu(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-snap only when the list, OS or pick changes
  }, [fingerprints, osFilter, f.gpu_preset_id]);

  /// What the GPU select calls: applies a pick that fits this machine, and asks first otherwise.
  /// The choice stays the operator's; the cost has to be known.
  const chooseGpu = (id: string) => {
    const verdict = compatById[id];
    if (verdict && !verdict.compatible && !suppressed) { setPendingGpu(id); return; }
    void setGpu(id);
  };

  const pickOs = (os: string) => {
    setOsFilter(os);
    setFilter("");
    // Move to the first GPU of the new OS when the current one does not belong to it.
    if (currentFp && !matchesOs(currentFp.platform, os)) {
      const first = fingerprints.find((g) => matchesOs(g.platform, os));
      if (first) void setGpu(first.id);
    }
  };

  /// Narrows the device list (brand or GPU maker); moves to a device that fits when the current one does not.
  const pickFilter = (value: string) => {
    setFilter(value);
    const fits = devicesFor(devices, osFilter, value);
    if (fits.length > 0 && !fits.some((d) => d.id === f.gpu_preset_id)) {
      const pick = fits[Math.floor(Math.random() * fits.length)];
      void setGpu(pick.id);
    }
  };

  /// "Random device": another device inside the filter.
  const randomize = () => {
    const pick = randomDevice(f.gpu_preset_id);
    if (pick) chooseGpu(pick.id);
  };

  return {
    osFilter,
    pickOs,
    filter,
    filterValues,
    pickFilter,
    deviceList,
    /** What the picked device looks like to a site; undefined until one is picked. */
    current: devices.find((d) => d.id === f.gpu_preset_id),
    randomize,
    gpusForOs,
    chooseGpu,
    /** Verdict for the picked GPU, or undefined while it is not known. */
    compat: compatById[f.gpu_preset_id],
    pendingGpu,
    pendingCompat: pendingGpu ? compatById[pendingGpu] : undefined,
    keepPending: () => { const id = pendingGpu; setPendingGpu(null); if (id) void setGpu(id); },
    cancelPending: () => setPendingGpu(null),
  };
}

export type GpuPicker = ReturnType<typeof useGpuPicker>;
