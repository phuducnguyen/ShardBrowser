// @vitest-environment node
// Reads files through Node's URL; under jsdom the global URL is a different class and fs rejects it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { build } from "../../../scripts/build-herov-css.mjs";

const lf = (s: string) => s.replace(/\r\n/g, "\n");

describe("HeroV stylesheet", () => {
  it("herov.generated.css matches docs/design-system (run `npm run build:herov-css` if this fails)", () => {
    const onDisk = readFileSync(new URL("./herov.generated.css", import.meta.url), "utf8");
    expect(lf(onDisk)).toBe(lf(build()));
  });

  it("scopes every rule under .hv, so Tailwind pages are untouched", () => {
    const css = build();
    const selectors = [...css.matchAll(/^([^\s@/*}][^{]*)\{/gm)].map((m) => m[1].trim());
    const loose = selectors.filter((s) => !/(^|,\s*)(\.hv\b|:root\[data-theme="dark"\] \.hv|:root:not\(\[data-theme="dark"\]\) \.hv)/.test(s) && !/^(from|to|\d+%)/.test(s));
    expect(loose).toEqual([]);
  });

  it("renames keyframes so they cannot clash with the app's own", () => {
    const names = [...build().matchAll(/@keyframes\s+(\S+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n.startsWith("hv-"))).toBe(true);
  });
});
