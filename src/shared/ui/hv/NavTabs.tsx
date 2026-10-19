import { useRef, type KeyboardEvent } from "react";
import type { TabItem } from "./Tabs";

/// Vertical tabs for the secondary-nav panel of a Template B window. Same contract as `Tabs`
/// (roving tabindex, the panel carries `id={`${idPrefix}-panel`}`), with Up/Down instead of Left/Right.
export function NavTabs<T extends string>({ label, idPrefix, value, tabs, onChange }: {
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
    if (e.key === "ArrowDown") next = (at + 1) % tabs.length;
    else if (e.key === "ArrowUp") next = (at - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div role="tablist" aria-orientation="vertical" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => { refs.current[tab.id] = el; }}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          className={tab.id === value ? "nav-item is-active" : "nav-item"}
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
