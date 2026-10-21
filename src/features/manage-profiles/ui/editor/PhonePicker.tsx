import { useEffect, useMemo, useState } from "react";
import { Chips, Icon } from "../../../../shared/ui/hv";
import { useT } from "../../../../shared/i18n";
import { toast } from "../../../../shared/lib/toast";
import type { CamoufoxDevice } from "../../../../entities/camoufox";
import type { ProfileForm } from "../../../../entities/profile";
import { FAMILIES, TIERS, applyFilter, counts, familyOf, phoneName, phones, pickRandom, versionsFor, type PhoneFilter } from "../../lib/phonePicker";

/// Choosing an Android phone: two filters that narrow a random pick, a device list grouped by class,
/// and an Android version limited to what that class of phone could run. Every phone in the pool is
/// already a consistent set (screen, pixel ratio, graphics chip, version), so none of this can produce
/// a contradiction. Each automatic change says so in a toast.
export function PhonePicker({ f, patch, isNew, library, firefox }: {
  f: ProfileForm;
  patch: (changes: Partial<ProfileForm>) => void;
  isNew: boolean;
  library: CamoufoxDevice[];
  firefox: string | null | undefined;
}) {
  const t = useT();
  const all = useMemo(() => phones(library), [library]);
  const [filter, setFilter] = useState<PhoneFilter>({ tier: "any", family: "any" });
  const list = useMemo(() => applyFilter(all, filter), [all, filter]);
  const cur = all.find((d) => d.id === f.camoufox_preset) ?? null;
  const n = counts(all, filter);

  const tierLabel = { high: t("camoufox.tierHigh"), mid: t("camoufox.tierMid"), low: t("camoufox.tierLow") };
  const familyLabel = { adreno: t("camoufox.familyAdreno"), mali: t("camoufox.familyMali"), powervr: t("camoufox.familyPowervr") };

  const set = (d: CamoufoxDevice, why: "random" | "fit" | "chosen") => {
    patch({ camoufox_preset: d.id, camoufox_android_version: "" });
    const device = phoneName(d);
    toast.info(why === "random" ? t("camoufox.pickedRandom", { device }) : why === "fit" ? t("camoufox.pickedFit", { device }) : t("camoufox.pickedChosen", { device }));
  };

  // A new profile with no phone, or one the filters now exclude, gets a random one that fits.
  useEffect(() => {
    if (!isNew || all.length === 0 || (cur && list.some((d) => d.id === cur.id))) return;
    const d = pickRandom(list.length > 0 ? list : all);
    if (d) set(d, cur ? "fit" : "random");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, all, list, cur?.id]);

  const random = () => {
    const d = pickRandom(list, cur?.id);
    if (d) set(d, "random");
  };

  const own = cur?.phone?.android;
  const version = f.camoufox_android_version || (own !== undefined ? String(own) : "");
  const changeVersion = (v: string) => {
    patch({ camoufox_android_version: v === String(own) ? "" : v });
    toast.ok(t("camoufox.versionToast", { n: v }));
  };

  return (
    <>
      <div className="group">
        <h2 className="sect">{t("camoufox.tierLabel")}</h2>
        <Chips
          name="phone-tier"
          label={t("camoufox.tierLabel")}
          value={filter.tier}
          options={[
            { value: "any", label: t("deviceSection.filterAny"), count: n.tier("any") },
            ...TIERS.map((x) => ({ value: x, label: tierLabel[x], count: n.tier(x), disabled: !isNew || n.tier(x) === 0 })),
          ]}
          onChange={(tier) => setFilter({ ...filter, tier })}
        />
        <h2 className="sect" style={{ marginTop: 16 }}>{t("camoufox.familyLabel")}</h2>
        <Chips
          name="phone-family"
          label={t("camoufox.familyLabel")}
          value={filter.family}
          options={[
            { value: "any", label: t("deviceSection.filterAny"), count: n.family("any") },
            ...FAMILIES.map((x) => ({ value: x, label: familyLabel[x], count: n.family(x), disabled: !isNew || n.family(x) === 0 })),
          ]}
          onChange={(family) => setFilter({ ...filter, family })}
        />
        <p className="hint tight">{t("camoufox.filterHelp")}</p>
      </div>

      <div className="group">
        <div className="dev-row">
          <div className="dev-pick">
            <label className="label" htmlFor="cf-device">{t("deviceSection.deviceLabel")}</label>
            <select id="cf-device" className="select" disabled={!isNew} value={f.camoufox_preset}
              onChange={(e) => { const d = all.find((x) => x.id === e.target.value); if (d) set(d, "chosen"); }}>
              {list.length === 0 && <option value="">{t("camoufox.noDevices")}</option>}
              {TIERS.map((tier) => {
                const group = list.filter((d) => d.phone?.tier === tier);
                return group.length === 0 ? null : (
                  <optgroup key={tier} label={tierLabel[tier]}>
                    {group.map((d) => <option key={d.id} value={d.id}>{phoneName(d)}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={random} disabled={!isNew || list.length === 0}>
            <Icon name="refresh" size={18} />{t("deviceSection.random")}
          </button>
        </div>
        <p className="hint tight">{t("deviceSection.count", { n: list.length })}</p>
      </div>

      {cur && cur.phone && (
        <div className="group">
          <label className="label" htmlFor="cf-android">{t("deviceSection.osVersion")}</label>
          <select id="cf-android" className="select narrow-select" disabled={!isNew} value={version} onChange={(e) => changeVersion(e.target.value)}>
            {versionsFor(cur).map((v) => <option key={v} value={String(v)}>{t("deviceSection.androidVersion", { n: v })}</option>)}
          </select>
          <p className="hint tight">{t("camoufox.versionHelp")}</p>
        </div>
      )}

      {cur && cur.phone && (
        <section className="group" aria-labelledby="cf-see">
          <div className="dev-head">
            <h2 className="sect" id="cf-see">{t("deviceSection.seeTitle")}</h2>
            <span className="chip-plain">{t("deviceSection.locked")}</span>
          </div>
          <dl className="dev-card">
            <div><dt>{t("deviceSection.platform")}</dt><dd>Android {version} · {t("deviceSection.kindPhone")}</dd></div>
            <div><dt>{t("deviceSection.browser")}</dt><dd>{firefox ? `Firefox ${firefox}` : "Firefox"}</dd></div>
            <div><dt>{t("deviceSection.screen")}</dt><dd>{cur.screen[0]}×{cur.screen[1]} @{cur.phone.dpr}x</dd></div>
            <div><dt>{t("deviceSection.cores")}</dt><dd>{cur.cores ?? "—"}</dd></div>
            <div><dt>{t("deviceSection.touch")}</dt><dd>5</dd></div>
            <div><dt>{t("camoufox.familyLabel")}</dt><dd>{familyLabel[familyOf(cur)]}</dd></div>
            <div className="wide"><dt>{t("deviceSection.graphics")}</dt><dd>{cur.gpu}</dd></div>
          </dl>
          <p className="hint">{t("camoufox.phoneGraphicsNote")}</p>
          <p className="hint">{t("camoufox.limits")}</p>
        </section>
      )}
    </>
  );
}
