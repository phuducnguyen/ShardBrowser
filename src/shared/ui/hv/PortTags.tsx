import { useState } from "react";
import { Icon } from "./Icon";

/// A list of TCP ports as removable tags with an input at the end. Accepts "3389", "3389, 5900" or
/// "3389 5900"; anything that is not a port (1–65535) is dropped. Commits on Enter, comma, space and blur.
export function PortTags({ id, label, value, onChange, placeholder, removeLabel }: {
  id: string;
  label: string;
  value: number[];
  onChange: (ports: number[]) => void;
  placeholder: string;
  /** Accessible name for a tag's remove button; `{port}` is replaced. */
  removeLabel: (port: number) => string;
}) {
  const [text, setText] = useState("");

  const commit = () => {
    const next = new Set(value);
    for (const token of text.split(/[\s,]+/).filter(Boolean)) {
      const n = parseInt(token, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 65535) next.add(n);
    }
    setText("");
    if (next.size !== value.length) onChange([...next].sort((a, b) => a - b));
  };

  return (
    <div className="tags">
      {value.map((port) => (
        <span className="tag" key={port}>
          {port}
          <button type="button" aria-label={removeLabel(port)} onClick={() => onChange(value.filter((p) => p !== port))}>
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={label}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); commit(); }
          else if (e.key === "Backspace" && text === "" && value.length > 0) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
      />
    </div>
  );
}
