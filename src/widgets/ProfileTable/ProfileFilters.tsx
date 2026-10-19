import { useEffect, useRef, useState } from "react";
import { Icon } from "../../shared/ui/hv";
import { useT } from "../../shared/i18n";
import { useProfile, useProfileCountries, type ProfileSort } from "../../entities/profile";

/// Sort order, connection and proxy country behind one button that shows how many are active.
/// (The status filter lives on the toolbar as chips, because it is the one people flip all day.)
export function ProfileFilters() {
  const t = useT();
  const filters = useProfile((s) => s.filters);
  const setFilters = useProfile((s) => s.setFilters);
  const clearFilters = useProfile((s) => s.clearFilters);
  const sort = useProfile((s) => s.sort);
  const setSort = useProfile((s) => s.setSort);
  const countries = useProfileCountries();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  const active = (filters.proxy !== "all" ? 1 : 0) + (filters.country ? 1 : 0) + (sort !== "added" ? 1 : 0);

  return (
    <span className="kebab-wrap" ref={wrap}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="filter" size={18} />
        {t("profileFilterBar.filters")}
        {active > 0 && <span className="badge-count" aria-label={t("profileFilterBar.filtersCount", { n: active })}>{active}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label={t("profileFilterBar.filters")}>
          <div>
            <label className="label" htmlFor="pf-sort">{t("profileFilterBar.orderTitle")}</label>
            <select id="pf-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as ProfileSort)}>
              <option value="added">{t("profileFilterBar.orderAdded")}</option>
              <option value="name-asc">{t("profileFilterBar.orderNameAsc")}</option>
              <option value="name-desc">{t("profileFilterBar.orderNameDesc")}</option>
              <option value="created-desc">{t("profileFilterBar.orderNewest")}</option>
              <option value="created-asc">{t("profileFilterBar.orderOldest")}</option>
              <option value="launched-desc">{t("profileFilterBar.orderLaunched")}</option>
              <option value="runtime-desc">{t("profileFilterBar.orderRuntime")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-conn">{t("profileFilterBar.connectionTitle")}</label>
            <select id="pf-conn" className="select" value={filters.proxy} onChange={(e) => setFilters({ proxy: e.target.value as typeof filters.proxy })}>
              <option value="all">{t("profileFilterBar.connectionAny")}</option>
              <option value="bound">{t("profileFilterBar.connectionBound")}</option>
              <option value="direct">{t("profileFilterBar.connectionDirect")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-country">{t("profileFilterBar.countryTitle")}</label>
            <select id="pf-country" className="select" value={filters.country} onChange={(e) => setFilters({ country: e.target.value })}>
              <option value="">{t("profileFilterBar.countryAny")}</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {active > 0 && (
            <button type="button" className="btn btn-text btn-sm" onClick={() => { clearFilters(); setSort("added"); }}>
              {t("profileFilterBar.clear")}
            </button>
          )}
        </div>
      )}
    </span>
  );
}
