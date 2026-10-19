/// `disabled` greys an option out; `hint` is the visible reason, shown under the label.
export type ChipOption<T extends string> = { value: T; label: string; count?: number; disabled?: boolean; hint?: string };

/// Single-choice group as filter chips (2–5 options; more belong in a select).
/// A real radio group underneath, so arrows and form semantics come for free.
export function Chips<T extends string>({ name, label, value, options, onChange }: {
  name: string;
  label: string;
  value: T;
  options: ChipOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className={o.disabled ? "is-disabled" : undefined}>
          <span>
            {o.label}
            {o.count !== undefined && <span className="n">{o.count}</span>}
            {o.hint && <small className="chip-hint">{o.hint}</small>}
          </span>
          <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
          <span className="rd" />
        </label>
      ))}
    </div>
  );
}
