import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./index";
import { STORAGE_KEY, factoryDefaults, useProfileDefaults } from "../../entities/profile-defaults";
import { useToastStore } from "../../shared/model/toast";
import { backend } from "../../test/tauri";

const fp = (id: string, platform: string, model: string, renderer: string) => ({
  id, label: id, platform, chrome: "152", gpu: renderer, tag_color: "#000", builtin: false,
  payload: {
    navigator: { platform, hardware_concurrency: 8, device_memory: 8, max_touch_points: platform === "Android" ? 5 : 0 },
    client_hints: { model, brand_version: "152" },
    screen: { width: 412, height: 915, device_pixel_ratio: 2 },
    webgl: { renderer },
  },
});

beforeEach(() => {
  backend.reset({
    settings_get: () => ({ theme: "dark", helper_enabled: true, helper_triggers: [], extra_args: "", api_enabled: true, api_port: 40325 }),
    settings_load_error: () => null,
    api_info: () => ({ base_url: "http://127.0.0.1:40325", token: "t" }),
    fingerprint_list: () => [
      fp("android-oneplus-nord-5", "Android", "Nord 5", "Adreno (TM) 740"),
      fp("android-vivo-y28", "Android", "V2347", "Mali-G57"),
      fp("win-nv", "Windows", "", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)"),
    ],
  });
  void useProfileDefaults.getState().reset();
  localStorage.clear();
  backend.calls = [];
  useToastStore.setState({ items: [] });
});

async function openTab() {
  const user = userEvent.setup();
  render(<SettingsPage />);
  await user.click(screen.getByRole("tab", { name: "Profile defaults" }));
  return user;
}

describe("Settings: Profile defaults", () => {
  it("shows the factory values and a Save button that waits for a change", async () => {
    await openTab();
    expect(screen.getByRole("radio", { name: "Windows" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Random in filter" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save defaults" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Camoufox/ })).toBeDisabled();
    for (const name of [/macOS/, /Linux/, /iOS/]) expect(screen.getByRole("radio", { name })).toBeDisabled();
  });

  it("keeps the page's own Save settings bar out of this tab", async () => {
    await openTab();
    expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Profile defaults");
  });

  it("offers brands for Android, narrows a pinned device by brand, and saves", async () => {
    const user = await openTab();
    await user.click(screen.getByRole("radio", { name: "Android" }));
    await waitFor(() => expect(within(screen.getByLabelText("Brand")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Any", "OnePlus", "vivo"]));
    expect(await screen.findByText("Each new profile gets a different device from the 2 that match.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Brand"), "vivo");
    await user.click(screen.getByRole("radio", { name: "Pinned device" }));
    const pinned = screen.getByLabelText("Pinned device", { selector: "select" });
    expect(within(pinned).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a device…", "vivo V2347"]);
    await user.selectOptions(pinned, "android-vivo-y28");
    await user.click(screen.getByRole("button", { name: "Save defaults" }));
    expect(useProfileDefaults.getState().defaults).toMatchObject({ os: "Android", mode: "pinned", filter: "vivo", pinnedId: "android-vivo-y28" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toMatchObject({ os: "Android", filter: "vivo" });
    expect(screen.getByRole("button", { name: "Save defaults" })).toBeDisabled();
    await waitFor(() => expect(useToastStore.getState().items.some((t) => t.text === "Profile defaults saved")).toBe(true));
    expect(backend.argsOf("profile_defaults_set")).toHaveLength(1);
    expect(backend.argsOf("profile_defaults_set")[0].value).toMatchObject({ os: "Android", filter: "vivo", pinnedId: "android-vivo-y28" });
  });

  it("says so when the file could not be written, and keeps what was typed", async () => {
    backend.handlers.profile_defaults_set = () => { throw "disk full"; };
    const user = await openTab();
    await user.click(screen.getByRole("radio", { name: "Android" }));
    await user.click(screen.getByRole("button", { name: "Save defaults" }));
    await waitFor(() => expect(useToastStore.getState().items.some((t) => /disk full/.test(t.text))).toBe(true));
    expect(screen.getByRole("radio", { name: "Android" })).toBeChecked();
  });

  it("changes protections, WebRTC, language and time zone", async () => {
    const user = await openTab();
    await user.click(screen.getByRole("checkbox", { name: "Fonts" }));
    await user.click(screen.getByRole("checkbox", { name: "Canvas" }));
    await user.click(screen.getByRole("radio", { name: "Block" }));
    await user.selectOptions(screen.getByLabelText("Language"), "en-GB");
    await user.selectOptions(screen.getByLabelText("Time zone"), "Europe/London");
    await user.click(screen.getByRole("button", { name: "Save defaults" }));
    expect(useProfileDefaults.getState().defaults).toMatchObject({
      webrtc: "block", language: "en-GB", timezone: "Europe/London",
      noise: { canvas: "real", webgl: "auto", audio: "auto", client_rects: "real", fonts: "auto", sensors: "real" },
    });
  });

  it("Reset to factory puts the factory values back, and saving makes them stick", async () => {
    useProfileDefaults.getState().save({ ...factoryDefaults(), os: "Android", webrtc: "block" });
    const user = await openTab();
    expect(screen.getByRole("radio", { name: "Android" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Reset to factory" }));
    expect(screen.getByRole("radio", { name: "Windows" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save defaults" }));
    expect(useProfileDefaults.getState().defaults).toEqual(factoryDefaults());
  });
});
