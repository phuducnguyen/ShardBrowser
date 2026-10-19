import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { GithubMark } from "../../shared/icons";
import { GH_REPO_URL } from "../../shared/lib/utils";
import { useT } from "../../shared/i18n";
import { FormDialog } from "../../shared/ui/hv";

/// One-time GitHub-star prompt shown after the app first loads. Dismissal is
/// remembered in localStorage so it never nags again.
export function StarModal() {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("shardx-star-prompt") === "done") return;
    // Let the UI settle before surfacing the prompt.
    const timer = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(timer);
  }, []);
  const close = () => {
    localStorage.setItem("shardx-star-prompt", "done");
    setShow(false);
  };
  const star = () => {
    openUrl(GH_REPO_URL).catch(() => {});
    close();
  };
  if (!show) return null;
  return (
    <FormDialog
      title={t("starModal.title")}
      onClose={close}
      onConfirm={star}
      confirmLabel={t("starModal.starButton")}
      cancelLabel={t("starModal.later")}
    >
      <p className="hint">
        <GithubMark size={18} />{" "}
        {t("starModal.blurbPart1")}<strong>{t("starModal.freeWord")}</strong>
        {t("starModal.blurbPart2")}<strong>{t("starModal.starWord")}</strong>
        {t("starModal.blurbPart3")}
      </p>
    </FormDialog>
  );
}
