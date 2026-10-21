import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import vi from "./locales/vi.json";
import { LANG_OPTIONS, translate } from "./index";

describe("Vietnamese", () => {
  it("is offered next to English and Chinese", () => {
    expect(LANG_OPTIONS.map((o) => o.value)).toEqual(["en", "vi", "zh"]);
    expect(LANG_OPTIONS.find((o) => o.value === "vi")?.label).toBe("Tiếng Việt");
  });

  it("translates a key and fills its placeholders", () => {
    expect(translate("vi", "profiles.title")).toBe("Profile");
    expect(translate("vi", "rail.settings")).toBe("Cài đặt");
    expect(translate("vi", "deviceSection.count", { n: 4 })).toBe("4 thiết bị phù hợp");
  });

  it("falls back to English for a key it does not have", () => {
    const table = vi as Record<string, string>;
    const key = "palette.click.label";
    const saved = table[key];
    expect(saved).toBeTruthy(); // the locale is complete today
    delete table[key];
    try {
      expect(translate("vi", key)).toBe(translate("en", key));
    } finally {
      table[key] = saved;
    }
  });

  it("is complete: every English key has a Vietnamese text", () => {
    expect(Object.keys(en).filter((k) => !(k in vi))).toEqual([]);
  });

  it("holds no key that English lacks, and keeps every placeholder of the English text", () => {
    const strays = Object.keys(vi).filter((k) => !(k in en));
    expect(strays).toEqual([]);
    const lost = Object.entries(vi as Record<string, string>).filter(([k, v]) => {
      const want = ((en as Record<string, string>)[k].match(/\{[a-zA-Z]+\}/g) ?? []).sort().join();
      return (v.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join() !== want;
    });
    expect(lost.map(([k]) => k)).toEqual([]);
  });
});
