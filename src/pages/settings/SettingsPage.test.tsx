import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./index";
import { ToastHost } from "../../widgets/ToastHost/ToastHost";
import { useToastStore } from "../../shared/model/toast";
import { backend } from "../../test/tauri";

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
  it("groups the settings into four sections, General first", async () => {
    await renderPage();
    const tabs = screen.getAllByRole("tab").map((x) => x.textContent);
    expect(tabs).toEqual(["General", "Browser", "Profile defaults", "Data", "API & MCP"]);
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Provider")).toHaveValue("ip-api.com");
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
