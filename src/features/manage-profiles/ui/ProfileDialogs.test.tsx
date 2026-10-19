import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickEditDialog } from "./QuickEditDialog";
import { FolderModal } from "./FolderModal";
import { TemplatePicker } from "./TemplatePicker";
import type { ProfileMeta } from "../../../entities/profile";
import type { ProxyEntry } from "../../../entities/proxy";
import type { FingerprintEntry } from "../../../entities/fingerprint";
import { useGpuCompat } from "../../../shared/model/gpuCompat";
import { backend } from "../../../test/tauri";

const profile: ProfileMeta = {
  id: "id-a-0001", name: "Shop A", notes: "Facebook ads", proxy_id: "p1", last_launched_at: null,
  created_at: "2026-09-01T00:00:00Z", pinned: false, folder: "", total_runtime_ms: 0, color: null, extensions: [], mobile: false,
};
const px = (id: string, host: string, port: number, country: string): ProxyEntry => ({
  id, name: "", kind: "socks5", host, port, username: "", password: "", country, notes: "",
});
const proxies = [px("p1", "203.0.113.18", 1080, "US"), px("p2", "198.51.100.12", 8080, "DE")];

describe("QuickEditDialog", () => {
  beforeEach(() => backend.reset({
    profile_bind_proxy: () => null,
    profile_get: () => ({ id: "id-a-0001", name: "Shop A", notes: "old", extra: 1 }),
    profile_save: ({ payload }) => payload,
  }));

  it("binds another proxy and reports it", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<QuickEditDialog kind="proxy" profile={profile} proxies={proxies} onClose={() => {}} onSaved={onSaved} />);
    expect(screen.getByRole("dialog", { name: "Bind proxy — Shop A" })).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Proxy" });
    expect(select).toHaveValue("p1");
    await user.selectOptions(select, "p2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(backend.argsOf("profile_bind_proxy")).toEqual([{ profileId: "id-a-0001", proxyId: "p2" }]);
  });

  it("can unbind to a direct connection", async () => {
    const user = userEvent.setup();
    render(<QuickEditDialog kind="proxy" profile={profile} proxies={proxies} onClose={() => {}} onSaved={() => {}} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Proxy" }), "");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(backend.argsOf("profile_bind_proxy")).toEqual([{ profileId: "id-a-0001", proxyId: null }]));
  });

  it("saves notes without losing the other fields of the stored profile", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<QuickEditDialog kind="notes" profile={profile} proxies={proxies} onClose={() => {}} onSaved={onSaved} />);
    const box = screen.getByRole("textbox", { name: "Notes" });
    expect(box).toHaveValue("Facebook ads");
    await user.clear(box);
    await user.type(box, "TikTok shop");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(backend.argsOf("profile_save")).toEqual([{ payload: { id: "id-a-0001", name: "Shop A", notes: "TikTok shop", extra: 1 } }]);
  });

  it("closes from Cancel without saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<QuickEditDialog kind="notes" profile={profile} proxies={proxies} onClose={onClose} onSaved={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(backend.argsOf("profile_save")).toEqual([]);
  });
});

describe("FolderModal", () => {
  it("creates a folder: Enter submits, blank and duplicate names cannot", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<FolderModal mode="create" existing={["Ads"]} onPick={() => {}} onCreate={onCreate} onClose={() => {}} />);
    const input = screen.getByRole("textbox", { name: "Folder name" });
    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    await user.type(input, "Ads");
    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "  Socials {Enter}");
    expect(onCreate).toHaveBeenCalledWith("Socials");
  });

  it("moves into an existing folder with one click", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<FolderModal mode="move" existing={["Ads", "Shops"]} onPick={onPick} onCreate={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Move to folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create & move" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Shops" }));
    expect(onPick).toHaveBeenCalledWith("Shops");
  });

  it("closes on Cancel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FolderModal mode="create" existing={[]} onPick={() => {}} onCreate={() => {}} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TemplatePicker", () => {
  const fp = (id: string, platform: string, label: string): FingerprintEntry => ({
    id, label, platform, chrome: "141", gpu: "ANGLE (Test GPU)", tag_color: "#535efd", builtin: true, payload: {},
  });
  const lib = [fp("fp-1", "Windows", "Win office"), fp("fp-2", "Windows", "Win gaming"), fp("fp-3", "macOS", "Mac air")];

  beforeEach(() => {
    useGpuCompat.setState({ byId: {}, caps: null, loaded: false, loading: false });
    backend.reset({
      host_platform: () => "Windows",
      gpu_caps: () => ({ renderer: "Test GPU", vendor: "x", webgl1: [], webgl2: [], engine_version: "1" }),
      gpu_caps_compat: () => ({
        "fp-2": { compatible: false, missing_webgl1: ["WEBGL_x"], missing_webgl2: [], missing_webgpu: [], profile_renderer: "R" },
      }),
    });
  });

  it("lists only fingerprints that match this machine and picks one", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TemplatePicker fingerprints={lib} onPick={onPick} onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "Pick a Windows fingerprint" })).toBeInTheDocument();
    expect(screen.getByText("Win office")).toBeInTheDocument();
    expect(screen.queryByText("Mac air")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Win office/ }));
    expect(onPick).toHaveBeenCalledWith("fp-1");
  });

  it("flags a fingerprint this GPU cannot back", async () => {
    render(<TemplatePicker fingerprints={lib} onPick={() => {}} onClose={() => {}} />);
    const card = await screen.findByRole("button", { name: /Win gaming/ });
    await waitFor(() => expect(card).toHaveTextContent("GPU mismatch"));
    expect(screen.getByRole("button", { name: /Win office/ })).not.toHaveTextContent("GPU mismatch");
  });

  it("explains an empty library", async () => {
    render(<TemplatePicker fingerprints={[]} onPick={() => {}} onClose={() => {}} />);
    expect(await screen.findByText(/No Windows fingerprints in the library yet/)).toBeInTheDocument();
  });
});
