import { useEffect, useState } from "react";
import { Chips, Icon, type ChipOption } from "../../shared/ui/hv";
import { useT } from "../../shared/i18n";
import { useProfile, useProxyMap, useVisibleProfiles } from "../../entities/profile";
import { ProfileFilters } from "./ProfileFilters";
import { ProfileRow } from "./ProfileRow";

// Rows render in steps of this many; each one subscribes to the store, so thousands at once would stall.
const PAGE = 200;

export function ProfileTable() {
  const t = useT();
  const rows = useVisibleProfiles();
  const proxyMap = useProxyMap();
  const total = useProfile((s) => s.profiles.length);
  const selected = useProfile((s) => s.selected);
  const selectProfiles = useProfile((s) => s.selectProfiles);
  const newProfile = useProfile((s) => s.newProfile);
  const running = useProfile((s) => s.running);
  const folder = useProfile((s) => s.folder);
  const search = useProfile((s) => s.search);
  const filters = useProfile((s) => s.filters);
  const [shown, setShown] = useState(PAGE);

  // Back to the first page whenever the list is narrowed or widened.
  useEffect(() => { setShown(PAGE); }, [folder, search, filters]);

  // Re-render every second while something runs, so the uptime labels tick without refetching.
  const [, setTick] = useState(0);
  const anyRunning = Object.keys(running).length > 0;
  useEffect(() => {
    if (!anyRunning) return;
    const h = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(h);
  }, [anyRunning]);

  const everyChecked = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const someChecked = rows.some((p) => selected.has(p.id));

  return (
    <div className="card stack clip">
      <Toolbar />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  className="chk"
                  type="checkbox"
                  aria-label={t("profiles.selectAll")}
                  checked={everyChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked && !everyChecked; }}
                  onChange={(e) => selectProfiles(e.target.checked, rows)}
                />
              </th>
              <th>{t("profiles.colProfile")}</th>
              <th>{t("profiles.colStatus")}</th>
              <th>{t("profiles.colProxy")}</th>
              <th>{t("profiles.colLastRun")}</th>
              <th><span className="sr-only">{t("profiles.colActions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((p) => (
              <ProfileRow key={p.id} profile={p} proxy={p.proxy_id ? proxyMap[p.proxy_id] ?? null : null} />
            ))}
            {rows.length > shown && (
              <tr className="empty-row">
                <td colSpan={6}>
                  <button type="button" className="btn btn-text btn-sm" onClick={() => setShown((n) => n + PAGE)}>
                    {t("profiles.showMore", { n: Math.min(PAGE, rows.length - shown) })}
                  </button>
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr className="empty-row">
                <td colSpan={6}>
                  {total === 0 ? (
                    <>
                      {t("profiles.emptyNone")}{" "}
                      <button type="button" className="btn btn-text btn-sm" onClick={newProfile}>
                        <Icon name="plus" size={18} />{t("profiles.newProfile")}
                      </button>
                    </>
                  ) : t("profiles.emptyFiltered")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Toolbar() {
  const t = useT();
  const profiles = useProfile((s) => s.profiles);
  const running = useProfile((s) => s.running);
  const search = useProfile((s) => s.search);
  const setSearch = useProfile((s) => s.setSearch);
  const status = useProfile((s) => s.filters.status);
  const setFilters = useProfile((s) => s.setFilters);

  const runningCount = profiles.filter((p) => running[p.id]).length;
  const options: ChipOption<"all" | "running" | "idle">[] = [
    { value: "all", label: t("profiles.statusAll"), count: profiles.length },
    { value: "running", label: t("profileRow.statusRunning"), count: runningCount },
    { value: "idle", label: t("profileRow.statusIdle"), count: profiles.length - runningCount },
  ];

  return (
    <div className="toolbar">
      <Chips name="profile-status" label={t("profiles.filterStatus")} value={status} options={options} onChange={(v) => setFilters({ status: v })} />
      <span className="grow" />
      <ProfileFilters />
      <label className="search">
        <Icon name="search" size={18} />
        <span className="sr-only">{t("profiles.searchLabel")}</span>
        <input type="search" placeholder={t("profiles.searchPlaceholder")} autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
    </div>
  );
}
