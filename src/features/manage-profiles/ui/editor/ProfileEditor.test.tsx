import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";
import { ThemeProvider } from "@proxyshard/shardx-ui-kit";
import { ProfileEditor } from "./ProfileEditor";
import { defaultForm, useProfile, type ProfileForm } from "../../../../entities/profile";
import type { FingerprintEntry } from "../../../../entities/fingerprint";
import type { ProxyEntry } from "../../../../entities/proxy";
import { useExtensions } from "../../../../entities/extension";
import { useGpuCompat } from "../../../../shared/model/gpuCompat";
import { useToastStore } from "../../../../shared/model/toast";
import { backend } from "../../../../test/tauri";

const fp = (id: string, label: string, platform: string): FingerprintEntry => ({
  id, label, platform, chrome: "152", gpu: label, tag_color: "#000", builtin: true,
  payload: { navigator: { user_agent: `UA of ${label}`, hardware_concurrency: 12, device_memory: 16 } },
});
const proxy = (id: string, kind: ProxyEntry["kind"], host: string, port: number, country = ""): ProxyEntry => ({
  id, name: "", kind, host, port, username: "", password: "", country, notes: "",
});

const FINGERPRINTS = [
  fp("win-1", "Windows · RTX 3060", "Windows"),
  fp("win-2", "Windows · RX 6600", "Windows"),
  fp("mac-1", "macOS · M2", "macOS"),
];

const startingStore = useProfile.getInitialState();
const draft = () => useProfile.getState().draft as ProfileForm;

function renderEditor(form: Partial<ProfileForm> = {}) {
  useProfile.setState({
    draft: { ...defaultForm(), gpu_preset_id: "win-1", ...form },
    expanded: form.id ? form.id : "__new__",
    fingerprints: FINGERPRINTS,
    proxies: [proxy("p1", "socks5", "203.0.113.18", 1080, "US"), proxy("p2", "http", "198.51.100.12", 8080)],
  });
  const user = userEvent.setup();
  render(<ThemeProvider><ProfileEditor /></ThemeProvider>);
  return user;
}
const openTab = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  backend.reset({
    enrich_picks_for_preset: () => ({ hardware_concurrency: 12, device_memory: 16, platform_version: "15.0.0" }),
    host_screen: () => [1920, 1080],
    gpu_caps: () => ({ renderer: "Test GPU", vendor: "x", webgl1: [], webgl2: [], engine_version: "1" }),
    gpu_caps_compat: () => ({}),
    extension_list: () => [],
    profile_save: ({ payload }) => ({ id: "new-1", name: (payload as { name: string }).name }),
    profile_bind_proxy: () => null,
    profile_list: () => [],
    proxy_list: () => [],
    proxy_save: ({ entry }) => ({ ...(entry as ProxyEntry), id: "p-new" }),
  });
  useProfile.setState(startingStore, true);
  useGpuCompat.setState({ byId: {}, loaded: false, loading: false, suppressed: false, caps: null });
  useExtensions.setState({ items: [], status: "idle" });
  useToastStore.setState({ items: [] });
  vi.mocked(open).mockReset();
});

describe("Profile editor: frame", () => {
  it("has eight tabs, Overview first, and moves between them with the arrow keys", async () => {
    const user = renderEditor();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Overview", "Proxy", "Extensions", "Language & time", "Privacy", "Location", "Advanced", "Cookies"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    tabs[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(tabs[7]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Overview");
  });

  it("says New profile with a Create button for a new one, Edit profile with Save for an existing one", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "New profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create profile" })).toBeInTheDocument();
  });

  it("says Edit profile with Save changes for an existing profile", () => {
    renderEditor({ id: "abc", name: "Shop A" });
    expect(screen.getByRole("heading", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Profile name")).toHaveValue("Shop A");
  });

  it("goes back without saving", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("button", { name: "Back to profiles" }));
    expect(useProfile.getState().draft).toBeNull();
    expect(useProfile.getState().expanded).toBeNull();
    expect(backend.argsOf("profile_save")).toHaveLength(0);
  });
});

describe("Profile editor: saving", () => {
  it("asks for a name first, focuses the field, and lets go once one is typed", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("button", { name: "Create profile" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give the profile a name.");
    expect(screen.getByLabelText("Profile name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Profile name")).toHaveFocus();
    expect(backend.argsOf("profile_save")).toHaveLength(0);
    await user.type(screen.getByLabelText("Profile name"), "Shop A");
    expect(screen.getByLabelText("Profile name")).not.toHaveAttribute("aria-invalid");
  });

  it("saves the typed name and the chosen settings, binds the proxy, and leaves the editor", async () => {
    const user = renderEditor();
    await user.type(screen.getByLabelText("Profile name"), "Shop A");
    await openTab(user, "Proxy");
    await user.selectOptions(screen.getByRole("combobox", { name: "Proxy" }), "p1");
    await user.click(screen.getByRole("button", { name: "Create profile" }));
    await waitFor(() => expect(backend.argsOf("profile_save")).toHaveLength(1));
    const payload = backend.argsOf("profile_save")[0].payload as { name: string; _meta: { gpu_preset_id: string } };
    expect(payload.name).toBe("Shop A");
    expect(payload._meta.gpu_preset_id).toBe("win-1");
    await waitFor(() => expect(backend.argsOf("profile_bind_proxy")).toEqual([{ profileId: "new-1", proxyId: "p1" }]));
    await waitFor(() => expect(useProfile.getState().expanded).toBeNull());
  });

  it("submits with Enter in the name field", async () => {
    const user = renderEditor();
    await user.type(screen.getByLabelText("Profile name"), "Quick{Enter}");
    await waitFor(() => expect(backend.argsOf("profile_save")).toHaveLength(1));
  });
});

describe("Profile editor: overview", () => {
  it("lists the GPUs of the chosen OS and switches the pick when the OS changes", async () => {
    const user = renderEditor({ gpu_preset_id: "win-1" });
    const gpu = screen.getByLabelText("Device");
    expect(within(gpu).getAllByRole("option").map((o) => o.textContent)).toEqual(["Windows · RTX 3060", "Windows · RX 6600"]);
    await user.click(screen.getByRole("radio", { name: "macOS" }));
    await waitFor(() => expect(draft().gpu_preset_id).toBe("mac-1"));
    expect(within(screen.getByLabelText("Device")).getAllByRole("option").map((o) => o.textContent)).toEqual(["macOS · M2"]);
  });

  it("applies the whole fingerprint of a picked GPU", async () => {
    const user = renderEditor({ gpu_preset_id: "win-1" });
    await user.selectOptions(screen.getByLabelText("Device"), "win-2");
    await waitFor(() => expect(draft().gpu_preset_id).toBe("win-2"));
    expect(draft().user_agent).toBe("UA of Windows · RX 6600");
    expect(draft().platform_version).toBe("15.0.0");
    expect(backend.argsOf("enrich_picks_for_preset")).toEqual([{ presetId: "win-2" }]);
  });

  it("snaps an empty pick to a GPU of the machine's OS", async () => {
    renderEditor({ gpu_preset_id: "" });
    await waitFor(() => expect(FINGERPRINTS.map((f) => f.id)).toContain(draft().gpu_preset_id));
  });

  it("asks before using a GPU this machine cannot back, and keeps the old pick on Pick another", async () => {
    backend.handlers.gpu_caps_compat = () => ({
      "win-2": { compatible: false, missing_webgl1: ["WEBGL_x"], missing_webgl2: [], missing_webgpu: [], profile_renderer: "RX 6600" },
    });
    const user = renderEditor({ gpu_preset_id: "win-1" });
    await waitFor(() => expect(Object.keys(useGpuCompat.getState().byId)).toContain("win-2"));
    await user.selectOptions(screen.getByLabelText("Device"), "win-2");
    expect(await screen.findByRole("button", { name: /Pick another/ })).toBeInTheDocument();
    expect(draft().gpu_preset_id).toBe("win-1");
    await user.click(screen.getByRole("button", { name: /Pick another/ }));
    expect(draft().gpu_preset_id).toBe("win-1");
  });

  it("uses the incompatible GPU on request, and then says so on the page", async () => {
    backend.handlers.gpu_caps_compat = () => ({
      "win-2": { compatible: false, missing_webgl1: ["WEBGL_x"], missing_webgl2: [], missing_webgpu: [], profile_renderer: "RX 6600" },
    });
    const user = renderEditor({ gpu_preset_id: "win-1" });
    await waitFor(() => expect(Object.keys(useGpuCompat.getState().byId)).toContain("win-2"));
    await user.selectOptions(screen.getByLabelText("Device"), "win-2");
    await user.click(await screen.findByRole("button", { name: /Use it anyway/ }));
    await waitFor(() => expect(draft().gpu_preset_id).toBe("win-2"));
    expect(await screen.findByText(/graphics features this machine's GPU doesn't have/)).toBeInTheDocument();
  });

  it("picks a colour, or automatic, as a radio group", async () => {
    const user = renderEditor();
    const group = screen.getByRole("radiogroup", { name: "Colour" });
    await user.click(within(group).getByRole("radio", { name: "#F04438" }));
    expect(draft().color).toBe("#F04438");
    expect(within(group).getByRole("radio", { name: "#F04438" })).toBeChecked();
    await user.click(within(group).getAllByRole("radio")[0]);
    expect(draft().color).toBe("");
  });

  it("keeps notes", async () => {
    const user = renderEditor();
    await user.type(screen.getByLabelText("Notes"), "for ads");
    expect(draft().notes).toBe("for ads");
  });
});

describe("Profile editor: proxy", () => {
  it("offers a direct connection and the saved proxies, and says what direct means", async () => {
    const user = renderEditor();
    await openTab(user, "Proxy");
    const select = screen.getByRole("combobox", { name: "Proxy" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "— direct connection —", "203.0.113.18:1080 · US", "198.51.100.12:8080 · http",
    ]);
    expect(screen.getByText(/connects directly/)).toBeInTheDocument();
    await user.selectOptions(select, "p2");
    expect(draft().proxy_id).toBe("p2");
    expect(screen.queryByText(/connects directly/)).not.toBeInTheDocument();
    await user.selectOptions(select, "");
    expect(draft().proxy_id).toBeNull();
  });

  it("understands a pasted proxy, saves it, and selects it", async () => {
    const user = renderEditor();
    await openTab(user, "Proxy");
    const add = screen.getByRole("button", { name: /Add and bind/ });
    expect(add).toBeDisabled();
    await user.type(screen.getByLabelText(/Create new/), "socks5://bob:pw@203.0.113.77:1080");
    expect(screen.getByRole("status")).toHaveTextContent("SOCKS5 203.0.113.77:1080 · bob");
    backend.handlers.profile_list = () => [];
    backend.handlers.proxy_list = () => [proxy("p-new", "socks5", "203.0.113.77", 1080)];
    await user.click(add);
    await waitFor(() => expect(draft().proxy_id).toBe("p-new"));
    expect(backend.argsOf("proxy_save")[0].entry).toMatchObject({ kind: "socks5", host: "203.0.113.77", port: 1080, username: "bob", password: "pw" });
  });

  it("says when a line cannot be read", async () => {
    const user = renderEditor();
    await openTab(user, "Proxy");
    await user.type(screen.getByLabelText(/Create new/), "not a proxy");
    expect(screen.getByRole("status")).toHaveTextContent(/Not a proxy line/);
    expect(screen.getByRole("button", { name: /Add and bind/ })).toBeDisabled();
  });
});

describe("Profile editor: extensions", () => {
  it("points to the library when it is empty", async () => {
    const user = renderEditor();
    await openTab(user, "Extensions");
    expect(await screen.findByText(/No extensions in the library/)).toBeInTheDocument();
  });

  it("ticks and unticks extensions from the library", async () => {
    backend.handlers.extension_list = () => [
      { id: "e1", name: "uBlock", version: "1.0", description: "ads-blocker", icon: "", path: "", size_bytes: 1, added_at: "@1" },
      { id: "e2", name: "Dark mode", version: "", description: "", icon: "", path: "", size_bytes: 1, added_at: "@1" },
    ];
    const user = renderEditor();
    await openTab(user, "Extensions");
    await user.click(await screen.findByRole("checkbox", { name: /uBlock/ }));
    expect(draft().extensions).toEqual(["e1"]);
    await user.click(screen.getByRole("checkbox", { name: /Dark mode/ }));
    expect(draft().extensions).toEqual(["e1", "e2"]);
    await user.click(screen.getByRole("checkbox", { name: /uBlock/ }));
    expect(draft().extensions).toEqual(["e2"]);
  });
});

describe("Profile editor: language, privacy, location", () => {
  it("sets timezone and language", async () => {
    const user = renderEditor();
    await openTab(user, "Language & time");
    await user.selectOptions(screen.getByLabelText("Timezone"), "Europe/Berlin");
    expect(draft().timezone).toBe("Europe/Berlin");
    const lang = screen.getByLabelText("Language");
    const pick = within(lang).getAllByRole("option")[1] as HTMLOptionElement;
    await user.selectOptions(lang, pick.value);
    expect(draft().language).toBe(pick.value);
  });

  it("sets WebRTC mode and Do Not Track", async () => {
    const user = renderEditor();
    await openTab(user, "Privacy");
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Block" }));
    expect(draft().webrtc).toBe("block");
    await user.click(screen.getByRole("checkbox", { name: "Do Not Track" }));
    expect(draft().do_not_track).toBe(true);
  });

  it("shows coordinates only for a manual location, and edits them", async () => {
    const user = renderEditor();
    await openTab(user, "Location");
    expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Manual coords" }));
    const lat = screen.getByLabelText("Latitude");
    await user.clear(lat);
    await user.type(lat, "10.5");
    expect(draft().geo_lat).toBe(10.5);
    expect(draft().geo_mode).toBe("manual");
  });
});

describe("Profile editor: advanced", () => {
  it("flips noise on and off per signal", async () => {
    const user = renderEditor();
    await openTab(user, "Advanced");
    const canvas = screen.getByRole("checkbox", { name: "Canvas" });
    expect(canvas).not.toBeChecked();
    await user.click(canvas);
    expect(draft().noise_canvas).toBe("auto");
    await user.click(canvas);
    expect(draft().noise_canvas).toBe("real");
  });

  it("sets both sides of the resolution at once, within the host's screen", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("radio", { name: "Windows" }));
    await openTab(user, "Advanced");
    const res = await screen.findByLabelText("Screen resolution");
    await waitFor(() => expect(within(res).queryByRole("option", { name: "3840 × 2160" })).not.toBeInTheDocument());
    await user.selectOptions(res, "1920x1080");
    expect(draft().screen_w).toBe(1920);
    expect(draft().screen_h).toBe(1080);
    await user.selectOptions(res, "");
    expect(draft().screen_w).toBe(0);
    expect(draft().screen_h).toBe(0);
  });

  it("hides the resolution on macOS", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("radio", { name: "macOS" }));
    await openTab(user, "Advanced");
    expect(screen.queryByLabelText("Screen resolution")).not.toBeInTheDocument();
  });

  it("edits blocked ports as tags", async () => {
    const user = renderEditor({ blocked_ports: [3389] });
    await openTab(user, "Advanced");
    const input = screen.getByLabelText("Ports to block");
    await user.type(input, "5900, 22 99999 abc{Enter}");
    expect(draft().blocked_ports).toEqual([22, 3389, 5900]);
    await user.click(screen.getByRole("button", { name: "Remove port 3389" }));
    expect(draft().blocked_ports).toEqual([22, 5900]);
    await user.type(input, "{Backspace}");
    expect(draft().blocked_ports).toEqual([22]);
  });

  it("changes hardware and media counts", async () => {
    const user = renderEditor();
    await openTab(user, "Advanced");
    await user.selectOptions(screen.getByLabelText("CPU cores"), "16");
    expect(draft().hardware_concurrency).toBe(16);
    await user.selectOptions(screen.getByLabelText("Mic in"), "2");
    expect(draft().media_audio_in).toBe(2);
  });

  it("offers the Android media switch only for a phone profile", async () => {
    const user = renderEditor({ user_agent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)" });
    await openTab(user, "Advanced");
    await user.click(screen.getByRole("checkbox", { name: /Android/ }));
    expect(draft().android_media).toBe(true);
  });
});

describe("Profile editor: cookies", () => {
  it("loads a cookies file, shows its name, and removes it", async () => {
    vi.mocked(open).mockResolvedValue("C:\\exports\\cookies.json");
    const user = renderEditor();
    await openTab(user, "Cookies");
    await user.click(screen.getByRole("button", { name: /Load from file/ }));
    await waitFor(() => expect(draft().cookies_file).toBe("C:\\exports\\cookies.json"));
    expect(screen.getByText("cookies.json")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "remove" }));
    expect(draft().cookies_file).toBe("");
  });

  it("keeps the old file when the dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);
    const user = renderEditor({ cookies_file: "a.json" });
    await openTab(user, "Cookies");
    await user.click(screen.getByRole("button", { name: /Change file/ }));
    expect(draft().cookies_file).toBe("a.json");
  });
});
