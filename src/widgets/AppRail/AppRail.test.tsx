import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ThemeProvider } from "@proxyshard/shardx-ui-kit";
import { AppRail } from "./AppRail";
import { useNav } from "../../shared/model/navigation";
import { useProfile } from "../../entities/profile";
import { useToastStore } from "../../shared/model/toast";
import { ToastHost } from "../ToastHost/ToastHost";
import { backend } from "../../test/tauri";

const upToDate = { current: "2.0.3", latest: "2.0.3", update_available: false, release_url: null };

function renderRail() {
  const user = userEvent.setup();
  render(<ThemeProvider><AppRail /><ToastHost /></ThemeProvider>);
  return { user, nav: screen.getByRole("navigation", { name: "Primary" }) };
}

beforeEach(() => {
  backend.reset({
    launcher_update_check: () => upToDate,
    api_info: () => ({ base_url: "http://127.0.0.1:40325", enabled: true }),
  });
  useNav.setState({ section: "browsers" });
  useToastStore.setState({ items: [] });
  vi.mocked(openUrl).mockClear();
});

describe("AppRail", () => {
  it("puts Profiles first and Proxies second", () => {
    const { nav } = renderRail();
    const labels = within(nav).getAllByRole("button").map((b) => b.textContent?.trim());
    expect(labels.slice(0, 3)).toEqual(["New profile", "Profiles", "Proxies"]); // the first button is "+ New profile"
    expect(labels).toEqual(expect.arrayContaining(["Fingerprints", "Extensions", "Bookmarks", "Automation", "Trash", "API", "Settings", "What's new", "Theme"]));
  });

  it("marks the current section and moves the mark when another is chosen", async () => {
    const { user, nav } = renderRail();
    expect(within(nav).getByRole("button", { name: "Profiles" })).toHaveAttribute("aria-current", "page");
    await user.click(within(nav).getByRole("button", { name: "Proxies" }));
    expect(useNav.getState().section).toBe("proxies");
    expect(within(nav).getByRole("button", { name: "Proxies" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "Profiles" })).not.toHaveAttribute("aria-current");
  });

  it("reaches every existing section", async () => {
    const { user, nav } = renderRail();
    const expected: Record<string, string> = {
      Fingerprints: "fingerprints", Extensions: "extensions", Bookmarks: "bookmarks",
      Automation: "automation", Trash: "trash", Settings: "settings",
    };
    for (const [label, section] of Object.entries(expected)) {
      await user.click(within(nav).getByRole("button", { name: label }));
      expect(useNav.getState().section).toBe(section);
    }
  });

  it("starts a new profile from the + button, whatever page is open", async () => {
    const newProfile = vi.fn();
    useProfile.setState({ newProfile });
    useNav.setState({ section: "proxies" });
    const { user } = renderRail();
    await user.click(screen.getByRole("button", { name: "New profile" }));
    expect(useNav.getState().section).toBe("browsers");
    expect(newProfile).toHaveBeenCalledTimes(1);
  });

  describe("collapsing", () => {
    beforeEach(() => { localStorage.removeItem("herov.rail.wide"); useNav.setState({ railWide: true }); });

    it("starts wide and collapses to an icon column that keeps tooltips", async () => {
      const { user, nav } = renderRail();
      expect(nav).toHaveClass("is-wide");
      expect(within(nav).getByRole("button", { name: "Proxies" })).not.toHaveAttribute("title");
      await user.click(within(nav).getByRole("button", { name: "Collapse menu" }));
      expect(nav).not.toHaveClass("is-wide");
      expect(useNav.getState().railWide).toBe(false);
      expect(within(nav).getByRole("button", { name: "Proxies" })).toHaveAttribute("title", "Proxies");
      expect(within(nav).getByRole("button", { name: "Expand menu" })).toHaveAttribute("aria-expanded", "false");
    });

    it("remembers the choice and expands again", async () => {
      const { user, nav } = renderRail();
      await user.click(within(nav).getByRole("button", { name: "Collapse menu" }));
      expect(localStorage.getItem("herov.rail.wide")).toBe("0");
      await user.click(within(nav).getByRole("button", { name: "Expand menu" }));
      expect(nav).toHaveClass("is-wide");
      expect(localStorage.getItem("herov.rail.wide")).toBe("1");
    });
  });

  describe("What's new", () => {
    it("opens the changelog when the launcher is up to date, with no update marker", async () => {
      const { user, nav } = renderRail();
      await waitFor(() => expect(backend.argsOf("launcher_update_check")).toHaveLength(1));
      expect(screen.queryByRole("img", { name: "Update available" })).not.toBeInTheDocument();
      await user.click(within(nav).getByRole("button", { name: "What's new" }));
      expect(useNav.getState().section).toBe("patchlog");
      expect(openUrl).not.toHaveBeenCalled();
    });

    it("flags an update and sends the person to the release page instead", async () => {
      backend.handlers.launcher_update_check = () => ({ current: "2.0.3", latest: "2.1.0", update_available: true, release_url: "https://example.com/release" });
      const { user, nav } = renderRail();
      expect(await screen.findByRole("img", { name: "Update available" })).toBeInTheDocument();
      await user.click(within(nav).getByRole("button", { name: /What's new/ }));
      expect(openUrl).toHaveBeenCalledWith("https://example.com/release");
      expect(useNav.getState().section).toBe("browsers");
    });
  });

  it("switches between the light and dark theme", async () => {
    const { user } = renderRail();
    const toggle = screen.getByRole("button", { name: "Switch between light and dark theme" });
    const before = document.documentElement.dataset.theme;
    expect(toggle).toHaveAttribute("aria-pressed", String(before === "dark"));
    await user.click(toggle);
    const after = document.documentElement.dataset.theme;
    expect(after).toBe(before === "dark" ? "light" : "dark");
    expect(toggle).toHaveAttribute("aria-pressed", String(after === "dark"));
  });

  describe("API dialog", () => {
    it("shows where the local API listens and copies the address", async () => {
      const { user } = renderRail();
      await user.click(screen.getByRole("button", { name: "API" }));
      const dialog = await screen.findByRole("dialog", { name: "Automation API" });
      expect(await within(dialog).findByText("127.0.0.1:40325")).toBeInTheDocument();
      expect(within(dialog).getByText("The local API is on.")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Copy API address" }));
      expect(backend.argsOf("clipboard_write")).toEqual([{ text: "http://127.0.0.1:40325" }]);
      expect(await screen.findByText("API address copied")).toBeInTheDocument();
    });

    it("says when the API is off and offers no address to copy", async () => {
      backend.handlers.api_info = () => ({ base_url: "http://127.0.0.1:40325", enabled: false });
      const { user } = renderRail();
      await user.click(screen.getByRole("button", { name: "API" }));
      const dialog = await screen.findByRole("dialog", { name: "Automation API" });
      expect(await within(dialog).findByText(/The local API is off/)).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Copy API address" })).not.toBeInTheDocument();
    });

    it("closes from its Close button", async () => {
      const { user } = renderRail();
      await user.click(screen.getByRole("button", { name: "API" }));
      const dialog = await screen.findByRole("dialog", { name: "Automation API" });
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Automation API" })).not.toBeInTheDocument());
    });
  });
});
