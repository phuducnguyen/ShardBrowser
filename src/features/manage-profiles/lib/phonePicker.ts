import type { CamoufoxDevice, PhoneTier } from "../../../entities/camoufox";

export type TierFilter = PhoneTier | "any";
export type FamilyFilter = Family | "any";
export type Family = "adreno" | "mali" | "powervr";

export const TIERS: PhoneTier[] = ["high", "mid", "low"];
export const FAMILIES: Family[] = ["adreno", "mali", "powervr"];

/// The GPU family a phone's graphics name belongs to.
export function familyOf(d: CamoufoxDevice): Family {
  const g = d.gpu.toLowerCase();
  return g.startsWith("adreno") ? "adreno" : g.startsWith("mali") ? "mali" : "powervr";
}

export type PhoneFilter = { tier: TierFilter; family: FamilyFilter };

export function phones(library: CamoufoxDevice[]): CamoufoxDevice[] {
  return library.filter((d) => d.os === "android" && d.phone);
}

export function applyFilter(list: CamoufoxDevice[], f: PhoneFilter): CamoufoxDevice[] {
  return list.filter((d) => (f.tier === "any" || d.phone?.tier === f.tier) && (f.family === "any" || familyOf(d) === f.family));
}

/// How many phones each choice of the other filter would leave, so a chip never leads to an empty list.
export function counts(list: CamoufoxDevice[], f: PhoneFilter) {
  const tier = (t: TierFilter) => applyFilter(list, { ...f, tier: t }).length;
  const family = (fa: FamilyFilter) => applyFilter(list, { ...f, family: fa }).length;
  return { tier, family };
}

/// A random phone from the list, not the one already chosen when there is another to pick.
export function pickRandom(list: CamoufoxDevice[], avoidId?: string, rnd: () => number = Math.random): CamoufoxDevice | null {
  const pool = list.length > 1 ? list.filter((d) => d.id !== avoidId) : list;
  if (pool.length === 0) return null;
  return pool[Math.floor(rnd() * pool.length)];
}

/// "Pixel 6 · 412×915" — the short name a picker row shows.
export function phoneName(d: CamoufoxDevice): string {
  return `${d.phone?.name ?? d.label} · ${d.screen[0]}×${d.screen[1]}`;
}

/// Versions to offer for a phone, newest first. Always holds the phone's own.
export function versionsFor(d: CamoufoxDevice): number[] {
  const p = d.phone;
  if (!p) return [];
  const out: number[] = [];
  for (let v = p.android_max; v >= p.android_min; v--) out.push(v);
  return out;
}
