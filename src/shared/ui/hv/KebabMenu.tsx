import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon";

export type MenuAction = { label: string; onSelect: () => void; danger?: boolean };

// Tall enough for the five items the proxy menu has; flips upward near the window's bottom edge.
const MENU_HEIGHT = 230;

/// Row action menu: opens on click, arrows move, Esc closes and returns focus to the
/// button, a click outside or Tab closes it. Destructive actions go last.
export function KebabMenu({ label, items }: { label: string; items: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector("button")?.focus();
    const outside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const toggle = () => {
    if (!open) {
      const rect = button.current?.getBoundingClientRect();
      setUp(!!rect && rect.bottom + MENU_HEIGHT > window.innerHeight);
    }
    setOpen((o) => !o);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const entries = [...(menu.current?.querySelectorAll("button") ?? [])];
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); entries[(at + 1) % entries.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); entries[(at - 1 + entries.length) % entries.length]?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === "Tab") close(false);
  };

  return (
    <span className="kebab-wrap">
      <button
        ref={button}
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div ref={menu} className={up ? "menu up" : "menu"} role="menu" onKeyDown={onKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? "danger" : undefined}
              onClick={() => { close(true); item.onSelect(); }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
