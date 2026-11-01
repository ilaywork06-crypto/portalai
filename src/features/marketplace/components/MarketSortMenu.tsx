import { useState } from "react";
import { useEscape } from "@/shared/lib/useEscape";
import { Icon } from "@/shared/ui/Icon";

interface SortMenuProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
}

export function MarketSortMenu<T extends string>({ value, onChange, options }: SortMenuProps<T>) {
  const [open, setOpen] = useState(false);
  useEscape(() => setOpen(false), open);
  const current = options.find(([id]) => id === value) ?? options[0];
  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button
        className="chip"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
      >
        <Icon name="arrowUpDown" size={14} style={{ color: "var(--ink-3)" }} />
        מיון: {current?.[1]}
        <Icon
          name="chevronRight"
          size={13}
          style={{ color: "var(--muted)", transform: open ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .15s var(--ease)" }}
        />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }}></div>
          <div
            className="card"
            role="listbox"
            style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 31, padding: 4, minWidth: 180, boxShadow: "var(--sh-md)", background: "var(--surface)" }}
          >
            {options.map(([id, label]) => (
              <button
                key={id}
                role="option"
                aria-selected={value === id}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className="row"
                style={{
                  gap: 8,
                  padding: "9px 12px",
                  width: "100%",
                  textAlign: "right",
                  borderRadius: "var(--r-sm)",
                  background: value === id ? "var(--accent-tint)" : "transparent",
                  color: value === id ? "var(--accent-ink)" : "var(--ink-2)",
                  fontWeight: value === id ? 600 : 450,
                  fontSize: 13.5,
                  border: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (value !== id) e.currentTarget.style.background = "var(--n-50)";
                }}
                onMouseLeave={(e) => {
                  if (value !== id) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon name="check" size={14} stroke={3} style={{ opacity: value === id ? 1 : 0, color: "var(--accent)", flex: "none" }} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
