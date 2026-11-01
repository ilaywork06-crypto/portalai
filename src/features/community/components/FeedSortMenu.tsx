import { useEffect, useRef, useState } from "react";
import { useEscape } from "@/shared/lib/useEscape";
import { Icon } from "@/shared/ui/Icon";
import type { FeedSort } from "../api";

const OPTIONS: readonly (readonly [FeedSort, string])[] = [
  ["new", "החדשים תחילה"],
  ["top", "הפוסטים המובילים"],
];

export function FeedSortMenu({ value, onChange }: { value: FeedSort; onChange: (value: FeedSort) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEscape(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const current = OPTIONS.find(([id]) => id === value) ?? OPTIONS[0];
  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button className="chip" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} style={{ cursor: "pointer", gap: 7 }}>
        <Icon name="sliders" size={13} style={{ color: "var(--muted)" }} /> {current?.[1]}
        <Icon name="chevronDown" size={13} style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s var(--ease)" }} />
      </button>
      {open && (
        <div
          className="card"
          role="listbox"
          style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, padding: 4, minWidth: 184, boxShadow: "var(--sh-md)", background: "var(--surface)" }}
        >
          {OPTIONS.map(([id, label]) => (
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
                width: "100%",
                gap: 9,
                padding: "9px 10px",
                borderRadius: "var(--r-sm)",
                textAlign: "right",
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
              <Icon name="check" size={14} stroke={3} style={{ opacity: value === id ? 1 : 0, color: "var(--accent)", flex: "none" }} /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
