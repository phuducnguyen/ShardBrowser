import type { ReactNode } from "react";

/// HeroV icon set: 24px grid, 1.8 stroke, round caps (see docs/design-guidelines.md §3).
/// Stroke and fill come from the `.ico` class in the generated stylesheet.
const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  server: <><rect x="4" y="4" width="16" height="6.5" rx="2" /><rect x="4" y="13.5" width="16" height="6.5" rx="2" /><path d="M8 7.25h.01M8 16.75h.01" /></>,
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  fingerprint: <path d="M12 4a7 7 0 0 0-7 7v2M12 8a3 3 0 0 0-3 3v4a5 5 0 0 0 1 3M12 11v4a8 8 0 0 0 2 5M19 11a7 7 0 0 0-4-6.3M16 12v2a11 11 0 0 1 1 4" />,
  puzzle: <path d="M10 4a2 2 0 0 1 4 0v2h4v4h-2a2 2 0 0 0 0 4h2v4h-4v-2a2 2 0 0 0-4 0v2H6v-4h2a2 2 0 0 0 0-4H6V6h4z" />,
  bookmark: <path d="M7 4h10v16l-5-4-5 4z" />,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />,
  pin: <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  folder: <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />,
  doc: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  more: <path d="M12 5h.01M12 12h.01M12 19h.01" strokeWidth="3" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l3 3" /></>,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `ico ${className}` : "ico"}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={size ? { width: size, height: size } : undefined}
    >
      {PATHS[name]}
    </svg>
  );
}

/// The HeroV mark: a shield with a V cut out of it. Colour comes from `currentColor`;
/// the V takes `--logo-facet` so it matches whatever the shield sits on.
export function HeroVMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M20 3 34.5 8.2V19c0 8.4-5.8 14.6-14.5 18C11.3 33.6 5.5 27.4 5.5 19V8.2z" fill="currentColor" />
      <path d="M20 3 5.5 8.2V19c0 8.4 5.8 14.6 14.5 18z" fill="#fff" fillOpacity=".18" />
      <path d="M12.8 13.5 20 27.5l7.2-14" fill="none" style={{ stroke: "var(--logo-facet, #fff)" }} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
