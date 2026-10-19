import { useRef, type KeyboardEvent } from "react";

export type TabItem<T extends string> = { id: T; label: string };

/// Horizontal tabs for sheets and dialogs. Roving tabindex; arrows, Home and End move
/// and activate. The panel it controls must carry `id={`${idPrefix}-panel`}` and
/// `aria-labelledby={`${idPrefix}-tab-${value}`}`.
export function Tabs<T extends string>({ label, idPrefix, value, tabs, onChange }: {
  label: string;
  idPrefix: string;
  value: T;
  tabs: TabItem<T>[];
  onChange: (id: T) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex((tab) => tab.id === value);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (at + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (at - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => { refs.current[tab.id] = el; }}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          className="tab"
          role="tab"
          aria-selected={tab.id === value}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={tab.id === value ? 0 : -1}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
