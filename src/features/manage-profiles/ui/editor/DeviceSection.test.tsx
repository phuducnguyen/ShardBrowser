import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@proxyshard/shardx-ui-kit";
import { ProfileEditor } from "./ProfileEditor";
import { defaultForm, useProfile, type ProfileForm } from "../../../../entities/profile";
import type { FingerprintEntry } from "../../../../entities/fingerprint";
import { factoryDefaults, useProfileDefaults } from "../../../../entities/profile-defaults";
import { useExtensions } from "../../../../entities/extension";
import { useGpuCompat } from "../../../../shared/model/gpuCompat";
import { useToastStore } from "../../../../shared/model/toast";
import { backend } from "../../../../test/tauri";

const android = (id: string, model: string, w: number, h: number): FingerprintEntry => ({
  id, label: id, platform: "Android", chrome: "152", gpu: "Adreno (TM) 740", tag_color: "#fb923c", builtin: false,
  payload: {
    navigator: { platform: "Android", user_agent: `UA ${model}`, hardware_concurrency: 8, device_memory: 8, max_touch_points: 5 },
    client_hints: { model, brand_version: "152" },
    screen: { width: w, height: h, device_pixel_ratio: 2.75 },
    webgl: { renderer: "Adreno (TM) 740" },
  },
});
const windows = (id: string, renderer: string, w = 1920, h = 1080): FingerprintEntry => ({
  id, label: id, platform: "Windows", chrome: "152", gpu: renderer, tag_color: "#5dade2", builtin: false,
  payload: {
    navigator: { platform: "Windows", user_agent: `UA ${id}`, hardware_concurrency: 12, device_memory: 16, max_touch_points: 0 },
    client_hints: { brand_version: "152" },
    screen: { width: w, height: h, device_pixel_ratio: 1 },
    webgl: { renderer },
  },
});

const FINGERPRINTS = [
  windows("win-amd", "ANGLE (AMD, AMD Radeon RX 6600 (0x000073FF) Direct3D11 vs_5_0 ps_5_0, D3D11)"),
  windows("win-nv", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)", 2560, 1440),
  android("android-oneplus-nord-5", "Nord 5", 412, 915),
  android("android-samsung-s25", "SM-S931B", 360, 780),
  android("android-samsung-a56", "SM-A566B", 384, 832),
  android("android-vivo-y28", "V2347", 360, 800),
];

const startingStore = useProfile.getInitialState();
const draft = () => useProfile.getState().draft as ProfileForm;

function renderEditor(form: Partial<ProfileForm> = {}) {
  useProfile.setState({
    draft: { ...defaultForm(), gpu_preset_id: "win-amd", ...form },
    expanded: form.id ? form.id : "__new__",
    fingerprints: FINGERPRINTS,
    proxies: [],
  });
  const user = userEvent.setup();
  render(<ThemeProvider><ProfileEditor /></ThemeProvider>);
  return user;
}

beforeEach(() => {
  backend.reset({
    enrich_picks_for_preset: () => ({ hardware_concurrency: 8, device_memory: 8, platform_version: "16.0.0" }),
    host_screen: () => [1920, 1080],
    gpu_caps: () => ({ renderer: "Test GPU", vendor: "x", webgl1: [], webgl2: [], engine_version: "1" }),
    gpu_caps_compat: () => ({}),
    extension_list: () => [],
    profile_list: () => [],
    proxy_list: () => [],
  });
  useProfile.setState(startingStore, true);
  useProfileDefaults.getState().reset();
  useGpuCompat.setState({ byId: {}, loaded: false, loading: false, suppressed: false, caps: null });
  useExtensions.setState({ items: [], status: "idle" });
  useToastStore.setState({ items: [] });
});

describe("Create profile: engine and OS", () => {
  it("offers Chrome, and shows Camoufox and iOS as unavailable with the reason on screen", () => {
    renderEditor();
    const engine = within(screen.getByRole("radiogroup", { name: "Browser engine" }));
    expect(engine.getByRole("radio", { name: /Chrome/ })).toBeChecked();
    expect(engine.getByRole("radio", { name: /Camoufox/ })).toBeDisabled();
    expect(engine.getByText("engine not installed")).toBeVisible();
    const os = within(screen.getByRole("radiogroup", { name: "Operating system" }));
    expect(os.getByRole("radio", { name: /iOS/ })).toBeDisabled();
    expect(os.getByText("planned")).toBeVisible();
    expect(os.getByRole("radio", { name: "Windows" })).toBeChecked();
    expect(os.getByRole("radio", { name: "Android" })).toBeEnabled();
  });
});

describe("Create profile: device", () => {
  it("shows Windows devices by graphics card and screen, with a GPU-maker filter", () => {
    renderEditor();
    const names = within(screen.getByLabelText("Device")).getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(["AMD Radeon RX 6600 · 1920×1080", "NVIDIA GeForce RTX 3060 · 2560×1440"]);
    expect(within(screen.getByLabelText("GPU maker")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Any", "AMD", "NVIDIA"]);
    expect(screen.queryByText(/win-amd/)).not.toBeInTheDocument();
  });

  it("switches to Android: brand filter, Brand Model names, no raw ids", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("radio", { name: "Android" }));
    await waitFor(() => expect(draft().gpu_preset_id).toMatch(/^android-/));
    expect(within(screen.getByLabelText("Brand")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Any", "OnePlus", "Samsung", "vivo"]);
    const names = within(screen.getByLabelText("Device")).getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(["OnePlus Nord 5", "Samsung SM-A566B", "Samsung SM-S931B", "vivo V2347"]);
    expect(screen.getByText("4 devices match")).toBeInTheDocument();
  });

  it("narrows the device list by brand and moves to a device of that brand", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("radio", { name: "Android" }));
    await waitFor(() => expect(draft().gpu_preset_id).toMatch(/^android-/));
    await user.selectOptions(screen.getByLabelText("Brand"), "Samsung");
    await waitFor(() => expect(draft().gpu_preset_id).toMatch(/^android-samsung-/));
    expect(within(screen.getByLabelText("Device")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Samsung SM-A566B", "Samsung SM-S931B"]);
    expect(screen.getByText("2 devices match")).toBeInTheDocument();
  });

  it("Random device always picks another device inside the filter", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("radio", { name: "Android" }));
    await user.selectOptions(await screen.findByLabelText("Brand"), "Samsung");
    await waitFor(() => expect(draft().gpu_preset_id).toMatch(/^android-samsung-/));
    for (let i = 0; i < 4; i += 1) {
      const before = draft().gpu_preset_id;
      await user.click(screen.getByRole("button", { name: "Random device" }));
      await waitFor(() => expect(draft().gpu_preset_id).not.toBe(before));
      expect(draft().gpu_preset_id).toMatch(/^android-samsung-/);
    }
  });

  it("describes the selected device in the 'What sites will see' card", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("radio", { name: "Android" }));
    await user.selectOptions(await screen.findByLabelText("Device"), "android-oneplus-nord-5");
    const card = within(await screen.findByRole("region", { name: "What sites will see" }));
    await waitFor(() => expect(card.getByText("412×915 @2.75x")).toBeInTheDocument());
    expect(card.getByText("Android · phone")).toBeInTheDocument();
    expect(card.getByText("Chrome 152")).toBeInTheDocument();
    expect(card.getByText("8 GB")).toBeInTheDocument();
    expect(card.getByText("5")).toBeInTheDocument();
    expect(card.getByText("Adreno (TM) 740")).toBeInTheDocument();
    expect(screen.getByText("Fixed when the profile is created")).toBeInTheDocument();
  });
});

describe("Create profile: OS version", () => {
  it("offers Windows 10 and the Windows 11 builds, and writes the chosen version", async () => {
    const user = renderEditor({ platform_version: "19.0.0" });
    const select = screen.getByLabelText("OS version");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Windows 10", "Windows 11 21H2", "Windows 11 22H2", "Windows 11 23H2", "Windows 11 24H2", "Windows 11 25H2",
    ]);
    expect(select).toHaveValue("19.0.0");
    await user.selectOptions(select, "10.0.0");
    expect(draft().platform_version).toBe("10.0.0");
  });

  it("offers Android 12 to 16 on Android", async () => {
    const user = renderEditor({ platform_version: "16.0.0" });
    await user.click(screen.getByRole("radio", { name: "Android" }));
    await waitFor(() => expect(draft().gpu_preset_id).toMatch(/^android-/));
    const select = await screen.findByLabelText("OS version");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Android 12", "Android 13", "Android 14", "Android 15", "Android 16"]);
    await user.selectOptions(select, "14.0.0");
    expect(draft().platform_version).toBe("14.0.0");
  });

  it("keeps an unusual version from the library visible instead of dropping it", () => {
    renderEditor({ platform_version: "5.0.0" });
    const select = screen.getByLabelText("OS version");
    expect(select).toHaveValue("5.0.0");
    expect(within(select).getByRole("option", { name: "Other (5.0.0)" })).toBeInTheDocument();
  });

  it("shows no version choice for macOS or Linux", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("radio", { name: "Linux" }));
    expect(screen.queryByLabelText("OS version")).not.toBeInTheDocument();
  });
});

describe("Create profile: starts from the profile defaults", () => {
  it("opens on the default OS and filter, and picks a device inside them", async () => {
    useProfileDefaults.getState().save({ ...factoryDefaults(), os: "Android", filter: "vivo" });
    renderEditor({ gpu_preset_id: "" });
    expect(screen.getByRole("radio", { name: "Android" })).toBeChecked();
    await waitFor(() => expect(draft().gpu_preset_id).toBe("android-vivo-y28"));
  });

  it("starts on the pinned device", async () => {
    useProfileDefaults.getState().save({ ...factoryDefaults(), os: "Android", mode: "pinned", pinnedId: "android-samsung-s25" });
    renderEditor({ gpu_preset_id: "" });
    await waitFor(() => expect(draft().gpu_preset_id).toBe("android-samsung-s25"));
  });

  it("does not touch an existing profile's device", () => {
    useProfileDefaults.getState().save({ ...factoryDefaults(), os: "Android", mode: "pinned", pinnedId: "android-samsung-s25" });
    renderEditor({ id: "p1", gpu_preset_id: "win-nv" });
    expect(screen.getByRole("radio", { name: "Windows" })).toBeChecked();
    expect(draft().gpu_preset_id).toBe("win-nv");
  });

  it("gives a new profile the protections, WebRTC, language and time zone of the defaults", () => {
    useProfileDefaults.getState().save({
      ...factoryDefaults(), webrtc: "block", language: "en-GB", timezone: "Europe/London",
      noise: { ...factoryDefaults().noise, fonts: "auto", canvas: "real" },
    });
    useProfile.getState().newProfile();
    expect(draft()).toMatchObject({ webrtc: "block", language: "en-GB", timezone: "Europe/London", noise_fonts: "auto", noise_canvas: "real", noise_webgl: "auto" });
    expect(useProfile.getState().expanded).toBe("__new__");
  });
});
