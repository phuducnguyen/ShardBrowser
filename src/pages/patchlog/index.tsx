import { Fragment, useState, type ReactNode } from "react";
import { Window } from "../../shared/ui/hv";
import { useT, useLang } from "../../shared/i18n";
import data from "./patchlog.json";

/** HeroV's own release log. The log is data, in patchlog.json (newest release first, one entry per
 *  user-visible change, English with an optional Vietnamese `vi`); this module only draws it. Add
 *  the release here in the same commit that sets its version (docs/releasing.md). */

type Block =
  | { type: "p" | "note"; text: string }
  | { type: "code"; text: string }
  | { type: "list"; items: string[] };

type Entry = {
  id: string;
  title: string;
  /** One line under the title: what it is, before any detail. */
  lead: string;
  /** "new", "improved" or "fix". */
  tag?: string;
  /** Which half of the product changed: the engines, or the launcher. */
  scope?: "browser" | "launcher";
  blocks: Block[];
  /** The same entry in Vietnamese. */
  vi?: { title: string; lead: string; blocks: Block[] };
};

type Release = { version: string; date: string; entries: Entry[] };

const RELEASES = data.releases as Release[];
/** Newest release, and the one the picker starts on. */
const LATEST = RELEASES[0];

/** Inline markup, deliberately tiny: `code`, **strong**, *emphasis*. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="log-body">
      {blocks.map((b, i) => {
        if (b.type === "code") return <pre key={i}>{b.text}</pre>;
        if (b.type === "list") {
          return (
            <ul key={i}>
              {b.items.map((it, j) => <li key={j}><Rich text={it} /></li>)}
            </ul>
          );
        }
        return <p key={i} className={b.type === "note" ? "soft" : undefined}><Rich text={b.text} /></p>;
      })}
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }): ReactNode {
  const t = useT();
  const lang = useLang((s) => s.lang);
  // Vietnamese text when the entry has it; English otherwise (Chinese falls back to English).
  const text = lang === "vi" && entry.vi ? entry.vi : entry;
  const tagLabel = entry.tag === "new" ? t("patchlog.tagNew") : entry.tag === "fix" ? t("patchlog.tagFix") : entry.tag === "improved" ? t("patchlog.tagImproved") : entry.tag;
  return (
    <article className="log-entry">
      <div className="log-head">
        <h2>{text.title}</h2>
        <span className="chip-plain">{entry.scope === "launcher" ? t("patchlog.scopeLauncher") : t("patchlog.scopeBrowser")}</span>
        {entry.tag && <span className={entry.tag === "new" ? "status" : "status is-idle"}>{tagLabel}</span>}
      </div>
      <p className="log-lead">{text.lead}</p>
      <Blocks blocks={text.blocks} />
    </article>
  );
}

export function PatchLogPage() {
  const t = useT();
  const [release, setRelease] = useState<Release>(LATEST);

  return (
    <Window
      single
      title={t("patchlog.title")}
      actions={
        <label className="release-pick">
          <span className="sr-only">{t("patchlog.releaseLabel")}</span>
          <select
            className="select"
            value={release.version}
            onChange={(e) => setRelease(RELEASES.find((r) => r.version === e.target.value) ?? LATEST)}
          >
            {RELEASES.map((r) => (
              <option key={r.version} value={r.version}>
                v{r.version} · {r.date}{r === LATEST ? ` · ${t("patchlog.latestBadge")}` : ""}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="card stack clip">
        <div className="fp-body">
          <p className="hint">
            {t("patchlog.introPart1")}
            <strong>{t("patchlog.introBrowserWord")}</strong>
            {t("patchlog.introPart2")}
            <strong>{t("patchlog.introLauncherWord")}</strong>
            {t("patchlog.introPart3")}
          </p>
          <div className="log-rule">
            <span>v{release.version} · {release.date}</span>
            <span className="line" />
            <span>
              {release.entries.length === 1
                ? t("patchlog.changeCountOne", { n: release.entries.length })
                : t("patchlog.changeCountMany", { n: release.entries.length })}
            </span>
          </div>
          {release.entries.map((e) => <EntryCard key={e.id} entry={e} />)}
        </div>
      </div>
    </Window>
  );
}
