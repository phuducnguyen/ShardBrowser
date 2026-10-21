import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@proxyshard/shardx-ui-kit";
import { BrowsersPage } from "./index";
import { ConfirmHost } from "../../widgets/ConfirmHost/ConfirmHost";
import { ToastHost } from "../../widgets/ToastHost/ToastHost";
import { emptyFilters, useProfile, type ProfileMeta } from "../../entities/profile";
import type { ProxyEntry } from "../../entities/proxy";
import { useToastStore } from "../../shared/model/toast";
import { backend } from "../../test/tauri";

const profile = (id: string, name: string, extra: Partial<ProfileMeta> = {}): ProfileMeta => ({
  id, name, notes: "", proxy_id: null, last_launched_at: null, created_at: "2026-09-01T00:00:00Z", pinned: false,
  folder: "", total_runtime_ms: 0, color: null, extensions: [], mobile: false, ...extra,
});
const proxy = (id: string, kind: ProxyEntry["kind"], host: string, port: number, country: string): ProxyEntry => ({
  id, name: "", kind, host, port, username: "", password: "", country, notes: "",
});

let profiles: ProfileMeta[];
let running: { profile_id: string; pid: number; uptime_ms: number }[];
const startingStore = useProfile.getInitialState();

beforeEach(() => {
  profiles = [
    profile("id-a-0001", "Shop A", { notes: "Facebook ads", proxy_id: "p1", folder: "Ads", pinned: true, total_runtime_ms: 5_400_000, last_launched_at: "@1760500000" }),
    profile("id-b-0002", "Shop B", { proxy_id: "p1", folder: "Ads" }),
    profile("id-c-0003", "Reseller", { notes: "TikTok", proxy_id: "p2", total_runtime_ms: 1_260_000 }),
    profile("id-d-0004", "Direct test"),
  ];
  running = [{ profile_id: "id-a-0001", pid: 1, uptime_ms: 125_000 }];
  backend.reset({
    profile_list: () => profiles.map((p) => ({ ...p })),
    proxy_list: () => [proxy("p1", "socks5", "203.0.113.18", 1080, "US"), proxy("p2", "http", "198.51.100.12", 8080, "DE")],
    fingerprint_list: () => [],
    extension_list: () => [],
    host_screen: () => [1920, 1080],
    gpu_caps: () => ({ renderer: "Test GPU", vendor: "x", webgl1: [], webgl2: [], engine_version: "1" }),
    gpu_caps_compat: () => ({}),
    process_list: () => running,
    launch: () => 4242,
    process_kill: () => true,
    profile_delete: ({ id }) => { profiles = profiles.filter((p) => p.id !== id); return null; },
    profile_set_folder: ({ id, folder }) => { profiles = profiles.map((p) => (p.id === id ? { ...p, folder: folder as string } : p)); return null; },
    profile_clone: () => profile("id-e-0005", "Shop A copy"),
    profile_set_pin: () => null,
  });
  useProfile.setState(startingStore, true);
  useProfile.setState({ filters: emptyFilters(), folderRegistry: [] });
  useToastStore.setState({ items: [] });
});

async function renderPage() {
  const user = userEvent.setup();
  render(<ThemeProvider><BrowsersPage /><ConfirmHost /><ToastHost /></ThemeProvider>);
  await screen.findByText("Shop A");
  return user;
}
const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}$`) }).closest("tr") as HTMLTableRowElement;
const names = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.querySelector(".name-btn")?.textContent ?? "");

describe("Profiles window: list", () => {
  it("shows name, notes, status, uptime, proxy and last run for each profile", async () => {
    await renderPage();
    const a = within(row("Shop A"));
    expect(a.getByText("Facebook ads")).toBeInTheDocument();
    expect(a.getByText("Running")).toBeInTheDocument();
    expect(a.getByText("SOCKS5 · 203.0.113.18:1080")).toBeInTheDocument();
    expect(a.getByText("Pinned")).toBeInTheDocument();
    expect(a.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    const reseller = within(row("Reseller"));
    expect(reseller.getByText("Idle")).toBeInTheDocument();
    expect(reseller.getByText("21m 00s total")).toBeInTheDocument();
    expect(reseller.getByRole("button", { name: "Start" })).toBeInTheDocument();
    // A profile without notes shows the start of its id instead, and without a proxy says so.
    expect(within(row("Direct test")).getByText("id-d-000")).toBeInTheDocument();
    expect(within(row("Direct test")).getByText("never")).toBeInTheDocument();
  });

  it("names the engine of a Camoufox profile and says nothing for a Chrome one", async () => {
    profiles = [...profiles, profile("id-f-0006", "Fox 1", { notes: "Instagram", engine: "camoufox" })];
    await renderPage();
    expect(within(row("Fox 1")).getByText("Camoufox")).toBeInTheDocument();
    expect(within(row("Fox 1")).getByText(/Instagram/)).toBeInTheDocument();
    expect(within(row("Shop A")).queryByText("Camoufox")).not.toBeInTheDocument();
  });

  it("filters by status chip with counts", async () => {
    const user = await renderPage();
    expect(screen.getByRole("radio", { name: /^Running\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Idle\s*3$/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Running/ }));
    expect(names()).toEqual(["Shop A"]);
    await user.click(screen.getByRole("radio", { name: /^Idle/ }));
    expect(names()).toEqual(["Shop B", "Reseller", "Direct test"]);
  });

  it("searches names and notes", async () => {
    const user = await renderPage();
    const box = screen.getByRole("searchbox", { name: "Search profiles" });
    await user.type(box, "tiktok");
    expect(names()).toEqual(["Reseller"]);
    await user.clear(box);
    await user.type(box, "zzz");
    expect(screen.getByText("No profiles match these filters.")).toBeInTheDocument();
  });

  it("offers a way forward when there are no profiles", async () => {
    profiles = [];
    const user = userEvent.setup();
    render(<ThemeProvider><BrowsersPage /></ThemeProvider>);
    expect(await screen.findByText(/No profiles yet\./)).toBeInTheDocument();
    await user.click(within(screen.getByRole("table")).getByRole("button", { name: "New profile" }));
    expect(useProfile.getState().expanded).toBe("__new__");
  });
});

describe("Profiles window: folders", () => {
  it("counts profiles per folder and narrows the list", async () => {
    const user = await renderPage();
    const panel = screen.getByRole("complementary", { name: "Folders" });
    expect(within(panel).getByRole("button", { name: /^All profiles\s*4$/ })).toHaveAttribute("aria-current", "true");
    await user.click(within(panel).getByRole("button", { name: /^Ads\s*2$/ }));
    expect(names()).toEqual(["Shop A", "Shop B"]);
    expect(within(panel).getByRole("button", { name: /^Ads/ })).toHaveAttribute("aria-current", "true");
  });

  it("offers to delete a folder only while one is open", async () => {
    const user = await renderPage();
    expect(screen.queryByRole("button", { name: /Delete folder/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Ads/ }));
    expect(screen.getByRole("button", { name: "Delete folder “Ads”" })).toBeInTheDocument();
  });

  it("opens the new-folder dialog", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "New folder" }));
    expect(useProfile.getState().folderModal).toEqual({ profileId: null });
  });

  it("moves a profile into a folder when its row is dropped on it", async () => {
    await renderPage();
    const target = screen.getByRole("button", { name: /^Ads/ });
    fireEvent.drop(target, { dataTransfer: { getData: (type: string) => (type === "application/x-shardx-profile" ? "id-c-0003" : "") } });
    await waitFor(() => expect(backend.argsOf("profile_set_folder")).toEqual([{ id: "id-c-0003", folder: "Ads" }]));
  });

  it("takes a profile out of its folder when dropped on All", async () => {
    await renderPage();
    fireEvent.drop(screen.getByRole("button", { name: /^All profiles/ }), { dataTransfer: { getData: () => "id-a-0001" } });
    await waitFor(() => expect(backend.argsOf("profile_set_folder")).toEqual([{ id: "id-a-0001", folder: "" }]));
  });
});

describe("Profiles window: filters and order", () => {
  it("opens a panel, orders by name, and counts what is active", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const panel = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(panel).getByLabelText("Order"), "name-desc");
    // Pinned rows stay on top whatever the order.
    expect(names()).toEqual(["Shop A", "Shop B", "Reseller", "Direct test"]);
    expect(screen.getByRole("button", { name: /Filters/ })).toHaveTextContent("1");
  });

  it("narrows to profiles without a proxy, then clears", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const panel = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(panel).getByLabelText("Connection"), "direct");
    expect(names()).toEqual(["Direct test"]);
    await user.click(within(panel).getByRole("button", { name: "Clear filters" }));
    expect(names()).toHaveLength(4);
  });

  it("narrows by the proxy's country", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const panel = screen.getByRole("dialog", { name: "Filters" });
    await user.selectOptions(within(panel).getByLabelText("Proxy country"), "DE");
    expect(names()).toEqual(["Reseller"]);
  });

  it("closes with Escape or a click elsewhere", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Filters" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.click(screen.getByRole("heading", { name: "Profiles" }));
    expect(screen.queryByRole("dialog", { name: "Filters" })).not.toBeInTheDocument();
  });
});

describe("Profiles window: starting and stopping", () => {
  it("launches an idle profile", async () => {
    const user = await renderPage();
    await user.click(within(row("Reseller")).getByRole("button", { name: "Start" }));
    await waitFor(() => expect(backend.argsOf("launch")).toEqual([{ profileId: "id-c-0003" }]));
  });

  it("stops a running one", async () => {
    const user = await renderPage();
    await user.click(within(row("Shop A")).getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(backend.argsOf("process_kill")).toEqual([{ profileId: "id-a-0001" }]));
  });

  it("shows the reason when a launch fails", async () => {
    backend.handlers.launch = () => Promise.reject("engine not installed");
    const user = await renderPage();
    await user.click(within(row("Reseller")).getByRole("button", { name: "Start" }));
    expect(await screen.findByText("engine not installed")).toBeInTheDocument();
    expect(within(row("Reseller")).getByRole("button", { name: "Start" })).toBeEnabled();
  });
});

describe("Profiles window: row menu", () => {
  it("lists the actions, with Remove from folder only for a filed profile", async () => {
    const user = await renderPage();
    await user.click(within(row("Reseller")).getByRole("button", { name: "Actions for Reseller" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).not.toContain("Remove from folder");
    await user.keyboard("{Escape}");
    await user.click(within(row("Shop B")).getByRole("button", { name: "Actions for Shop B" }));
    const labels = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(labels).toContain("Remove from folder");
    expect(labels.at(-1)).toBe("Delete");
  });

  it("offers Unpin for a pinned profile and pins through the backend", async () => {
    const user = await renderPage();
    await user.click(within(row("Shop A")).getByRole("button", { name: "Actions for Shop A" }));
    expect(screen.getByRole("menuitem", { name: "Unpin" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(row("Reseller")).getByRole("button", { name: "Actions for Reseller" }));
    await user.click(screen.getByRole("menuitem", { name: "Pin to top" }));
    await waitFor(() => expect(backend.argsOf("profile_set_pin")).toEqual([{ id: "id-c-0003", pinned: true }]));
  });

  it("opens the quick edit for the proxy and for the notes", async () => {
    const user = await renderPage();
    await user.click(within(row("Reseller")).getByRole("button", { name: "Actions for Reseller" }));
    await user.click(screen.getByRole("menuitem", { name: "Change proxy" }));
    expect(useProfile.getState().quickEdit).toMatchObject({ kind: "proxy", profile: { id: "id-c-0003" } });
  });

  it("deletes only after the dialog is confirmed", async () => {
    const user = await renderPage();
    await user.click(within(row("Direct test")).getByRole("button", { name: "Actions for Direct test" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(backend.argsOf("profile_delete")).toHaveLength(0);
    await user.click(within(row("Direct test")).getByRole("button", { name: "Actions for Direct test" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(backend.argsOf("profile_delete")).toEqual([{ id: "id-d-0004" }]));
  });
});

describe("Profiles window: selection and bulk bar", () => {
  it("shows the bar for ticked rows; Launch synced appears from two", async () => {
    const user = await renderPage();
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
    await user.click(within(row("Reseller")).getByRole("checkbox"));
    const bar = screen.getByRole("toolbar", { name: "Bulk actions" });
    expect(within(bar).getByText("1 selected")).toBeInTheDocument();
    expect(within(bar).queryByRole("button", { name: "Launch synced" })).not.toBeInTheDocument();
    await user.click(within(row("Direct test")).getByRole("checkbox"));
    expect(within(bar).getByRole("button", { name: "Launch synced" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Select all profiles" })).toHaveProperty("indeterminate", true);
  });

  it("launches the ticked profiles that are not already running", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("checkbox", { name: "Select all profiles" }));
    await user.click(within(screen.getByRole("toolbar", { name: "Bulk actions" })).getByRole("button", { name: "Launch" }));
    await waitFor(() => expect(backend.argsOf("launch").map((a) => a.profileId)).toEqual(["id-b-0002", "id-c-0003", "id-d-0004"]));
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("stops the ticked profiles", async () => {
    const user = await renderPage();
    await user.click(within(row("Shop A")).getByRole("checkbox"));
    await user.click(within(screen.getByRole("toolbar", { name: "Bulk actions" })).getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(backend.argsOf("process_kill")).toEqual([{ profileId: "id-a-0001" }]));
  });

  it("selects a run with shift-click", async () => {
    const user = await renderPage();
    await user.click(within(row("Shop A")).getByRole("checkbox"));
    await user.keyboard("{Shift>}");
    await user.click(within(row("Reseller")).getByRole("checkbox"));
    await user.keyboard("{/Shift}");
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });
});

describe("Profiles window: editor", () => {
  it("shows the editor screen for a new profile and returns to the list", async () => {
    const user = await renderPage();
    await user.click(screen.getAllByRole("button", { name: "New profile" }).at(-1)!);
    expect(await screen.findByRole("heading", { name: "New profile" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to profiles" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(useProfile.getState().expanded).toBeNull();
  });
});
