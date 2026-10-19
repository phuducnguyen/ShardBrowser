import { Icon } from "./Icon";

/// Pick one colour from a fixed set, or "A" for automatic (the value ""). A radio group, so the
/// arrow keys work; the selected swatch carries a ring and a check, not just a different colour.
export function Swatches({ label, value, colors, autoLabel, onChange }: {
  label: string;
  value: string;
  colors: readonly string[];
  autoLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={value === ""}
        aria-label={autoLabel}
        title={autoLabel}
        className={value === "" ? "swatch auto is-active" : "swatch auto"}
        onClick={() => onChange("")}
      >
        A
      </button>
      {colors.map((c) => {
        const on = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c}
            title={c}
            className={on ? "swatch is-active" : "swatch"}
            style={{ background: c }}
            onClick={() => onChange(c)}
          >
            {on && <Icon name="check" size={18} />}
          </button>
        );
      })}
    </div>
  );
}
