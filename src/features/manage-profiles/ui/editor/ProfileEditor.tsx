import { useEffect, useRef, useState } from "react";
import { useCamoufox } from "../../../../entities/camoufox";
import { NavTabs, Window, type TabItem } from "../../../../shared/ui/hv";
import { useT } from "../../../../shared/i18n";
import { useProfile, type ProfileForm } from "../../../../entities/profile";
import { IncompatibleWarningModal } from "../../../gpu-compat";
import { useGpuPicker } from "../../lib/useGpuPicker";
import { AdvancedTab } from "./AdvancedTab";
import { OverviewTab } from "./OverviewTab";
import { CookiesTab, ExtensionsTab, LocaleTab, LocationTab, PrivacyTab } from "./OtherTabs";
import { ProxyTab } from "./ProxyTab";
import type { EditorTab, TabProps, Update } from "./types";

const PREFIX = "profile-editor";

/// New / Edit profile (Template B): the sections of the form as tabs on the left, the name and the
/// primary action always in view. It edits the store's `draft`, so saving, cookies import and the
/// folder rule stay in `saveDraft`.
export function ProfileEditor() {
  const draft = useProfile((s) => s.draft);
  return draft ? <EditorBody f={draft} /> : null;
}

function EditorBody({ f }: { f: ProfileForm }) {
  const t = useT();
  const setDraft = useProfile((s) => s.setDraft);
  const fingerprints = useProfile((s) => s.fingerprints);
  const saveDraft = useProfile((s) => s.saveDraft);
  const cancelEdit = useProfile((s) => s.cancelEdit);
  const [tab, setTab] = useState<EditorTab>("overview");
  const [nameMissing, setNameMissing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const gpu = useGpuPicker(f, setDraft, fingerprints);
  const isNew = !f.id;

  // Always start from the latest draft: a GPU pick lands after an await, and two changes in one event
  // would otherwise each start from the same stale form.
  const patch = (changes: Partial<ProfileForm>) => {
    const current = useProfile.getState().draft ?? f;
    setDraft({ ...current, ...changes });
  };
  const u: Update = (key, value) => patch({ [key]: value } as Partial<ProfileForm>);
  const props: TabProps = { f, u, patch };

  const submit = () => {
    if (!f.name.trim()) {
      setNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    void saveDraft();
  };

  useEffect(() => { void useCamoufox.getState().load(); }, []);

  const allTabs: TabItem<EditorTab>[] = [
    { id: "overview", label: t("profileEditor.tabOverview") },
    { id: "proxy", label: t("profileEditor.tabProxy") },
    { id: "extensions", label: t("profileEditor.tabExtensions") },
    { id: "locale", label: t("profileEditor.tabLocale") },
    { id: "privacy", label: t("profileEditor.tabPrivacy") },
    { id: "location", label: t("profileEditor.tabLocation") },
    { id: "advanced", label: t("profileEditor.tabAdvanced") },
    { id: "cookies", label: t("profileEditor.tabCookies") },
  ];
  // A Camoufox profile takes language, location and privacy from its proxy and device; extensions,
  // cookie files and the Chrome-only switches do not apply to it.
  const tabs = f.engine === "camoufox" ? allTabs.filter((x) => x.id === "overview" || x.id === "proxy") : allTabs;
  const shownTab: EditorTab = tabs.some((x) => x.id === tab) ? tab : "overview";

  return (
    <>
      <Window
        title={isNew ? t("profiles.editorTitleNew") : t("profiles.editorTitleEdit")}
        actions={<button type="button" className="btn btn-text btn-sm" onClick={cancelEdit}>{t("profiles.editorBack")}</button>}
      >
        <aside className="panel" aria-label={t("profileEditor.tablist")}>
          <NavTabs label={t("profileEditor.tablist")} idPrefix={PREFIX} value={shownTab} tabs={tabs} onChange={setTab} />
        </aside>
        <div className="stack">
          <div className="card formbar">
            <div className="fieldwrap">
              <input
                ref={nameRef}
                className="field-dashed"
                aria-label={t("inlineEditor.nameLabel")}
                aria-invalid={nameMissing || undefined}
                aria-describedby="pe-name-err"
                placeholder={t("inlineEditor.namePlaceholder")}
                autoComplete="off"
                value={f.name}
                onChange={(e) => { setNameMissing(false); patch({ name: e.target.value }); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              />
              <p id="pe-name-err" className="hint is-error tight" role="alert">{nameMissing ? t("profileEditor.nameRequired") : ""}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={submit}>
              {isNew ? t("inlineEditor.createProfile") : t("inlineEditor.saveChanges")}
            </button>
          </div>
          <div className="card grow">
            <div className="tabpanel" role="tabpanel" id={`${PREFIX}-panel`} aria-labelledby={`${PREFIX}-tab-${shownTab}`} key={shownTab}>
              {shownTab === "overview" && <OverviewTab {...props} gpu={gpu} />}
              {shownTab === "proxy" && <ProxyTab {...props} />}
              {shownTab === "extensions" && <ExtensionsTab {...props} />}
              {shownTab === "locale" && <LocaleTab {...props} />}
              {shownTab === "privacy" && <PrivacyTab {...props} />}
              {shownTab === "location" && <LocationTab {...props} />}
              {shownTab === "advanced" && <AdvancedTab {...props} osFilter={gpu.osFilter} />}
              {shownTab === "cookies" && <CookiesTab {...props} />}
            </div>
          </div>
        </div>
      </Window>
      {/* The warning for a GPU this machine cannot back is a FormDialog with its own `.hv` root. */}
      {gpu.pendingCompat && (
        <IncompatibleWarningModal compat={gpu.pendingCompat} onKeep={gpu.keepPending} onCancel={gpu.cancelPending} />
      )}
    </>
  );
}
