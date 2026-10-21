import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ThemeProvider } from "@proxyshard/shardx-ui-kit";
import { PhonePicker } from "./PhonePicker";
import { defaultForm, type ProfileForm } from "../../../../entities/profile";
import type { CamoufoxDevice, PhoneTier } from "../../../../entities/camoufox";
import { useToastStore } from "../../../../shared/model/toast";
import { applyFilter, counts, pickRandom, versionsFor } from "../../lib/phonePicker";

const phone = (id: string, name: string, gpu: string, tier: PhoneTier, w: number, h: number, dpr: number, android: number, min: number, max: number): CamoufoxDevice => ({
  id, os: "android", label: `Android · ${name}`, screen: [w, h], cores: 8, gpu,
  phone: { name, dpr, android, android_min: min, android_max: max, gpu_vendor: gpu.startsWith("Adreno") ? "Qualcomm" : "ARM", tier },
});

const LIBRARY: CamoufoxDevice[] = [
  phone("cf-and-0", "Pixel 6", "Mali-G78", "mid", 412, 915, 2.625, 14, 11, 15),
  phone("cf-and-1", "Galaxy S24", "Adreno (TM) 750", "high", 384, 832, 2.8125, 14, 13, 16),
  phone("cf-and-2", "Adreno 610 · ×2", "Adreno (TM) 610", "low", 360, 760, 2, 11, 10, 13),
  phone("cf-and-3", "Adreno 650 · ×2.8125", "Adreno (TM) 650", "mid", 384, 854, 2.8125, 12, 11, 15),
  { id: "cf-win-0", os: "windows", label: "Windows · 1920×1080", screen: [1920, 1080], cores: 8, gpu: "Intel", phone: null },
];

function Harness({ isNew = true, start = "" }: { isNew?: boolean; start?: string }) {
  const [f, setF] = useState<ProfileForm>({ ...defaultForm(), engine: "camoufox", camoufox_preset: start });
  return (
    <ThemeProvider>
      <PhonePicker f={f} patch={(c) => setF((p) => ({ ...p, ...c }))} isNew={isNew} library={LIBRARY} firefox="158" />
      <output data-testid="state">{f.camoufox_preset}|{f.camoufox_android_version}</output>
    </ThemeProvider>
  );
}
const state = () => screen.getByTestId("state").textContent ?? "";
const toasts = () => useToastStore.getState().items.map((t) => JSON.stringify(t));

beforeEach(() => useToastStore.setState({ items: [] }));

describe("phone helpers", () => {
  it("filters by class and family, and counts what each chip would leave", () => {
    const phones = LIBRARY.filter((d) => d.phone);
    expect(applyFilter(phones, { tier: "mid", family: "any" }).map((d) => d.id)).toEqual(["cf-and-0", "cf-and-3"]);
    expect(applyFilter(phones, { tier: "mid", family: "adreno" }).map((d) => d.id)).toEqual(["cf-and-3"]);
    const c = counts(phones, { tier: "any", family: "mali" });
    expect([c.tier("any"), c.tier("mid"), c.tier("high")]).toEqual([1, 1, 0]);
  });

  it("picks at random but not the phone already chosen", () => {
    const phones = LIBRARY.filter((d) => d.phone);
    for (let i = 0; i < 20; i++) expect(pickRandom(phones, "cf-and-1")?.id).not.toBe("cf-and-1");
    expect(pickRandom([phones[0]], "cf-and-0")?.id).toBe("cf-and-0");
    expect(pickRandom([])).toBeNull();
  });

  it("offers only the versions the phone's class could run, newest first, holding its own", () => {
    const d = LIBRARY[1];
    expect(versionsFor(d)).toEqual([16, 15, 14, 13]);
    expect(versionsFor(d)).toContain(d.phone!.android);
  });
});

describe("PhonePicker", () => {
  it("picks a phone on its own for a new profile and says so", () => {
    render(<Harness />);
    expect(state().startsWith("cf-and-")).toBe(true);
    expect(toasts().some((t) => /random/i.test(t))).toBe(true);
  });

  it("narrows the list with a class chip and moves to a phone that fits, with a toast", async () => {
    const user = userEvent.setup();
    render(<Harness start="cf-and-0" />);
    useToastStore.setState({ items: [] });
    await user.click(screen.getByRole("radio", { name: /Flagship/ }));
    expect(state().split("|")[0]).toBe("cf-and-1");
    expect(toasts().some((t) => /Galaxy S24/.test(t))).toBe(true);
    const list = screen.getByLabelText("Device") as HTMLSelectElement;
    expect([...list.options].map((o) => o.value)).toEqual(["cf-and-1"]);
  });

  it("lists devices grouped by class", () => {
    render(<Harness start="cf-and-0" />);
    const list = screen.getByLabelText("Device");
    const groups = within(list).getAllByRole("group").map((g) => g.getAttribute("label"));
    expect(groups).toEqual(["Flagship", "Mid-range", "Entry-level"]);
  });

  it("random picks another phone and announces it", async () => {
    const user = userEvent.setup();
    render(<Harness start="cf-and-0" />);
    useToastStore.setState({ items: [] });
    await user.click(screen.getByRole("button", { name: /Random device/ }));
    expect(state().split("|")[0]).not.toBe("cf-and-0");
    expect(toasts().length).toBe(1);
  });

  it("offers only valid Android versions and stores a change, with a toast", async () => {
    const user = userEvent.setup();
    render(<Harness start="cf-and-2" />);
    const sel = screen.getByLabelText("OS version") as HTMLSelectElement;
    expect([...sel.options].map((o) => o.value)).toEqual(["13", "12", "11", "10"]);
    expect(sel.value).toBe("11");
    useToastStore.setState({ items: [] });
    await user.selectOptions(sel, "13");
    expect(state()).toBe("cf-and-2|13");
    expect(toasts().some((t) => /Android 13/.test(t))).toBe(true);
    await user.selectOptions(sel, "11");
    expect(state()).toBe("cf-and-2|");
  });

  it("is read-only once the profile exists", () => {
    render(<Harness isNew={false} start="cf-and-0" />);
    expect(screen.getByLabelText("Device")).toBeDisabled();
    expect(screen.getByLabelText("OS version")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Random device/ })).toBeDisabled();
  });
});
