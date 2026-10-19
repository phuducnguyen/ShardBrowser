import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatchLogPage } from "./index";
import data from "./patchlog.json";

const releases = data.releases;

describe("Patch log window", () => {
  it("opens on the newest release and lists all of its entries", () => {
    render(<PatchLogPage />);
    const newest = releases[0];
    expect(screen.getByRole("combobox")).toHaveValue(newest.version);
    expect(screen.getByText(`v${newest.version} · ${newest.date}`)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(newest.entries.length);
    expect(screen.getByText(`${newest.entries.length} changes`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: newest.entries[0].title })).toBeInTheDocument();
  });

  it("marks the newest release as latest in the picker", () => {
    render(<PatchLogPage />);
    const options = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(options).toHaveLength(releases.length);
    expect(options[0]).toMatch(/latest/);
    expect(options.slice(1).every((o) => !/latest/.test(o))).toBe(true);
  });

  it("switches to an older release", async () => {
    const user = userEvent.setup();
    render(<PatchLogPage />);
    const older = releases[1];
    await user.selectOptions(screen.getByRole("combobox"), older.version);
    expect(screen.getAllByRole("article")).toHaveLength(older.entries.length);
    expect(screen.getByRole("heading", { level: 2, name: older.entries[0].title })).toBeInTheDocument();
  });

  it("tells a browser change from a launcher change and a new feature from a fix", () => {
    render(<PatchLogPage />);
    const entries = releases[0].entries as { scope?: string; tag?: string }[];
    const scopes = new Set(entries.map((e) => e.scope ?? "browser"));
    for (const s of scopes) {
      expect(screen.getAllByText(s === "launcher" ? "Launcher" : "Browser").length).toBeGreaterThan(0);
    }
    const tags = new Set(entries.map((e) => e.tag).filter(Boolean));
    for (const tag of tags) expect(screen.getAllByText(tag as string).length).toBeGreaterThan(0);
  });
});
