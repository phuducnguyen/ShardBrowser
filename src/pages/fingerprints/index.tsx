import { useEffect, useState } from "react";
import { Window } from "../../shared/ui/hv";
import { useFingerprint, useFingerprintGroups } from "../../entities/fingerprint";
import {
  FingerprintImporter, ImportFromFileButton, LibraryFolderButton, PasteJsonButton,
} from "../../features/manage-fingerprints";
import { FingerprintLibrary } from "../../widgets/FingerprintLibrary/FingerprintLibrary";
import { PlatformPanel } from "../../widgets/FingerprintLibrary/PlatformPanel";
import { useT } from "../../shared/i18n";

export function FingerprintsPage() {
  const t = useT();
  const init = useFingerprint((s) => s.init);
  const reload = useFingerprint((s) => s.reload);
  const importerOpen = useFingerprint((s) => s.importerOpen);
  const setImporterOpen = useFingerprint((s) => s.setImporterOpen);
  const groups = useFingerprintGroups();
  const [picked, setPicked] = useState("all");
  // A removed fingerprint can empty its platform; fall back to the full list rather than show nothing.
  const platform = picked === "all" || groups.some(([name]) => name === picked) ? picked : "all";

  useEffect(() => { init(); }, [init]);

  return (
    <>
      <Window
        title={t("fingerprints.title")}
        actions={
          <>
            <LibraryFolderButton />
            <ImportFromFileButton />
            <PasteJsonButton />
          </>
        }
      >
        <PlatformPanel active={platform} onPick={setPicked} />
        <FingerprintLibrary platform={platform} />
      </Window>
      {importerOpen && (
        <FingerprintImporter onClose={() => { setImporterOpen(false); reload(); }} />
      )}
    </>
  );
}
