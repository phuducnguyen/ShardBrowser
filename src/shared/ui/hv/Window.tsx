import { useId, type ReactNode } from "react";

/// The frame every HeroV window shares: title bar row, then the two-column view
/// (secondary nav + content). `overlays` render inside the same `.hv` scope so
/// sheets and dialogs pick up the design tokens; do not put ui-kit components
/// in a `.hv` tree, its reset (`color: inherit`) would override their colours.
export function Window({ title, actions, overlays, single, children }: {
  title: string;
  actions?: ReactNode;
  /// One content column, for a window with no secondary navigation.
  single?: boolean;
  overlays?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <div className="hv" style={{ height: "100%" }}>
      <div className="main">
        <header className="topbar">
          <h1 id={headingId}>{title}</h1>
          <span className="grow" />
          {actions}
        </header>
        <section className={single ? "view single" : "view"} aria-labelledby={headingId}>{children}</section>
      </div>
      {overlays}
    </div>
  );
}
