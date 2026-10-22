import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./index";
import { ToastHost } from "../../widgets/ToastHost/ToastHost";
import { useToastStore } from "../../shared/model/toast";
import { backend } from "../../test/tauri";
import { useBuildInfo } from "../../shared/model/buildInfo";

let loadError: string | null;

beforeEach(() => {
  loadError = null;
  backend.reset({
    settings_get: () => ({
      browser_path: null, theme: "dark", geo_checker: "ip-api.com", screen_resolution_mode: "fingerprint",
      helper_enabled: true, helper_triggers: ["email"], camera_enabled: true, extra_args: "--lang=en", api_enabled: true, api_port: 40325,
    }),
    settings_load_error: () => loadError,
    settings_save: () => null,
    api_info: () => ({ enabled: true, port: 40325, base_url: "http://127.0.0.1:40325", token: "tok-old" }),
    api_regenerate_token: () => ({ enabled: true, port: 40325, base_url: "http://127.0.0.1:40325", token: "tok-new" }),
    data_root_get: () => ({ path: "C:\\Users\\me\\ShardX", custom: false, migrating: false }),
  });
  useToastStore.setState({ items: [] });
});

async function renderPage() {
  const user = userEvent.setup();
  render(<><SettingsPage /><ToastHost /></>);
  await waitFor(() => expect(backend.argsOf("settings_get")).toHaveLength(1));
  return user;
}
const goTo = (user: ReturnType<typeof userEvent.setup>, name: string) => user.click(screen.getByRole("tab", { name }));

describe("Settings window", () => {
  it("groups the settings into sections, General first and About last", async () => {
    await renderPage();
    const tabs = screen.getAllByRole("tab").map((x) => x.textContent);
    expect(tabs).toEqual(["General", "Browser", "Profile defaults", "Data", "API & MCP", "About"]);
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Provider")).toHaveValue("ip-api.com");
  });

  it("About shows the running build, says a test build is one, and finds a newer release", async () => {
    useBuildInfo.setState({ info: null, aboutRequested: false });
    backend.handlers.app_build_info = () => ({ version: "0.2.0-beta.1", commit: "abc12345", built_unix: 1792800000, channel: "beta", engine_compat: "2.0.3" });
    backend.handlers.launcher_update_check = () => ({ current: "0.2.0-beta.1", latest: "v0.2.0-beta.2", update_available: true, release_url: "https://example.com/r" });
    const user = await renderPage();
    await goTo(user, "About");
    expect(await screen.findByTestId("about-version")).toHaveTextContent("v0.2.0-beta.1");
    expect(screen.getByText("Test build (beta)")).toBeInTheDocument();
    expect(screen.getByText("abc12345")).toBeInTheDocument();
    expect(await screen.findByTestId("about-update")).toHaveTextContent("A newer version is available: v0.2.0-beta.2");
    expect(screen.getByRole("button", { name: /Get the update/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
  });

  it("opens on About when the rail's version chip asked for it", async () => {
    backend.handlers.app_build_info = () => ({ version: "0.2.0", commit: "abc12345", built_unix: 0, channel: "stable", engine_compat: "2.0.3" });
    backend.handlers.launcher_update_check = () => ({ current: "0.2.0", latest: "v0.2.0", update_available: false, release_url: null });
    useBuildInfo.setState({ info: null, aboutRequested: true });
    await renderPage();
    expect(screen.getByRole("tab", { name: "About" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Stable")).toBeInTheDocument();
    expect(await screen.findByText("You are on the latest version.")).toBeInTheDocument();
    expect(useBuildInfo.getState().aboutRequested).toBe(false);
  });

  it("shows the Camoufox engine under Browser, with its size, and installs it on request", async () => {
    backend.handlers.camoufox_status = () => ({ supported: true, installed: false, version: "v158.0-beta.40", binary_path: null, size_bytes: null, download_bytes: 1_315_506_159 });
    backend.handlers.camoufox_install = () => ({ supported: true, installed: true, version: "v158.0-beta.40", binary_path: "C:\\x\\camoufox.exe", size_bytes: 2_572_155_417, download_bytes: 1_315_506_159 });
    const user = await renderPage();
    await goTo(user, "Browser");
    expect(await screen.findByText(/Not installed · 1\.3 GB to download/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Install" }));
    await waitFor(() => expect(backend.argsOf("camoufox_install")).toEqual([{ force: false }]));
    expect(await screen.findByText(/Installed · v158\.0-beta\.40 · 2\.6 GB on disk/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Reinstall" })).toBeEnabled();
  });

  it("moves between sections with the arrow keys", async () => {
    const user = await renderPage();
    screen.getByRole("tab", { name: "General" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Browser" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Browser");
  });

  it("saves every changed value in one go, whichever section it was changed in", async () => {
    const user = await renderPage();
    await user.selectOptions(screen.getByLabelText("Provider"), "ipwho.is");
    await goTo(user, "Browser");
    await user.click(screen.getByRole("checkbox", { name: "First name" }));
    await user.click(screen.getByRole("checkbox", { name: /camera/i }));
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(backend.argsOf("settings_save")).toHaveLength(1));
    expect(backend.argsOf("settings_save")[0]).toEqual({
      value: expect.objectContaining({
        geo_checker: "ipwho.is",
        helper_triggers: ["email", "first_name"],
        camera_enabled: false,
        extra_args: "--lang=en",
      }),
    });
  });

  it("hides the trigger list while the helper is switched off", async () => {
    const user = await renderPage();
    await goTo(user, "Browser");
    expect(screen.getByRole("group")).toBeInTheDocument();
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("shows where the data lives", async () => {
    const user = await renderPage();
    await goTo(user, "Data");
    expect(await screen.findByText("C:\\Users\\me\\ShardX")).toBeInTheDocument();
  });

  it("shows the API address, keeps the token masked, and swaps it after regenerating", async () => {
    const user = await renderPage();
    await goTo(user, "API & MCP");
    expect(await screen.findByDisplayValue("http://127.0.0.1:40325")).toHaveAttribute("readonly");
    const token = screen.getByDisplayValue("tok-old");
    expect(token).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /Regenerate/ }));
    expect(await screen.findByDisplayValue("tok-new")).toBeInTheDocument();
    expect(backend.argsOf("api_regenerate_token")).toHaveLength(1);
  });

  it("keeps the default port when the field is cleared", async () => {
    const user = await renderPage();
    await goTo(user, "API & MCP");
    const port = screen.getByRole("spinbutton");
    await user.clear(port);
    expect(port).toHaveValue(40325);
  });

  it("tells the operator when settings.json could not be read", async () => {
    loadError = "expected value at line 1";
    await renderPage();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/expected value at line 1/)).toBeInTheDocument();
    expect(within(alert).getByText("settings.json.bad")).toBeInTheDocument();
  });
});
