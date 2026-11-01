import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/shared/ui/Icon";
import { HE_DOW } from "../model/calendar";
import { formatDateTime, parseDateTime } from "../model/dates";
import { pad2 } from "../model/format";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const dayKey = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;

interface DateTimePickProps {
  value: string;
  min: string;
  max: string;
  invalid: boolean;
  label: string;
  onChange: (value: string) => void;
}

/** Date and hour picker in the design language (hour resolution). */
export function DateTimePick({ value, min, max, invalid, label, onChange }: DateTimePickProps) {
  const [open, setOpen] = useState(false);
  const current = parseDateTime(value);
  const [view, setView] = useState({ y: current.y, m: current.m });
  const ref = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = hoursRef.current;
    if (!open || !box) return;
    const selected = box.querySelector<HTMLElement>("[data-sel='1']");
    if (selected) box.scrollTop = selected.offsetTop - box.clientHeight / 2 + selected.offsetHeight / 2;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const lower = parseDateTime(min);
  const upper = parseDateTime(max);
  const kMin = dayKey(lower.y, lower.m, lower.d);
  const kMax = dayKey(upper.y, upper.m, upper.d);
  const leading = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const canPrev = view.y > lower.y || view.m > lower.m;
  const canNext = view.y < upper.y || view.m < upper.m;
  const shift = (months: number) => {
    const d = new Date(view.y, view.m + months, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const isSelected = (d: number) => view.y === current.y && view.m === current.m && d === current.d;
  const navButton = (disabled: boolean): CSSProperties => ({
    width: 30,
    height: 30,
    borderRadius: 8,
    border: 0,
    background: "transparent",
    display: "grid",
    placeItems: "center",
    cursor: disabled ? "default" : "pointer",
    color: disabled ? "var(--faint)" : "var(--ink-2)",
    opacity: disabled ? 0.4 : 1,
  });
  const hover = (on: boolean) => (e: { currentTarget: HTMLElement }) => {
    e.currentTarget.style.background = on ? "var(--n-50)" : "transparent";
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          if (!open) setView({ y: current.y, m: current.m });
          setOpen(!open);
        }}
        aria-label={label}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className="row"
        style={{
          gap: 10,
          height: 38,
          padding: "0 12px",
          minWidth: 200,
          border: `1px solid ${invalid ? "var(--err)" : open ? "var(--c-400)" : "var(--border-strong)"}`,
          boxShadow: open ? "0 0 0 3px rgba(218,133,52,0.16)" : "none",
          borderRadius: "var(--r-md)",
          background: "var(--surface)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13.5,
          cursor: "pointer",
          justifyContent: "space-between",
        }}
      >
        <span className="row" style={{ gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-3)" }} aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" }}>{`${current.d}.${current.m + 1}.${current.y}`}</span>
        </span>
        <span className="row" style={{ gap: 6, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
          <Icon name="clock" size={14} style={{ color: "var(--ink-3)" }} />
          <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>{`${pad2(current.h)}:00`}</span>
        </span>
      </button>
      {open && (
        <div
          className="card"
          style={{ position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, zIndex: 60, padding: 0, boxShadow: "var(--sh-lg)", background: "var(--surface)", display: "flex", overflow: "hidden" }}
        >
          <div style={{ padding: 14, width: 272 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <button type="button" disabled={!canPrev} onClick={() => canPrev && shift(-1)} style={navButton(!canPrev)} title="חודש קודם" aria-label="חודש קודם">
                <Icon name="chevronRight" size={16} />
              </button>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>
                {MONTHS[view.m]} {view.y}
              </span>
              <button type="button" disabled={!canNext} onClick={() => canNext && shift(1)} style={navButton(!canNext)} title="חודש הבא" aria-label="חודש הבא">
                <Icon name="chevronLeft" size={16} />
              </button>
            </div>
            <div data-grid="fixed" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {HE_DOW.map((d) => (
                <span key={d} className="t-cap" style={{ textAlign: "center", fontWeight: 600, padding: "4px 0", color: "var(--muted)" }}>
                  {d}
                </span>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <span key={`e${i}`} />;
                const k = dayKey(view.y, view.m, d);
                const disabled = k < kMin || k > kMax;
                const selected = isSelected(d);
                const today = k === kMax;
                return (
                  <button
                    type="button"
                    key={i}
                    disabled={disabled}
                    onClick={() => onChange(formatDateTime({ y: view.y, m: view.m, d, h: current.h }))}
                    onMouseEnter={disabled || selected ? undefined : hover(true)}
                    onMouseLeave={disabled || selected ? undefined : hover(false)}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: today && !selected ? "1px solid var(--c-300)" : 0,
                      fontFamily: "inherit",
                      fontSize: 13.5,
                      fontVariantNumeric: "tabular-nums",
                      cursor: disabled ? "default" : "pointer",
                      background: selected ? "var(--accent)" : "transparent",
                      color: selected ? "#fff" : disabled ? "var(--faint)" : "var(--ink)",
                      fontWeight: selected ? 700 : 500,
                      opacity: disabled ? 0.45 : 1,
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ borderInlineStart: "1px solid var(--border-soft)", width: 84, display: "flex", flexDirection: "column" }}>
            <span className="t-cap" style={{ fontWeight: 600, textAlign: "center", padding: "12px 0 6px", color: "var(--muted)" }}>
              שעה
            </span>
            <div ref={hoursRef} style={{ overflowY: "auto", maxHeight: 262, padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 2, position: "relative" }}>
              {Array.from({ length: 24 }, (_, h) => {
                const selected = h === current.h;
                return (
                  <button
                    type="button"
                    key={h}
                    data-sel={selected ? "1" : "0"}
                    onClick={() => {
                      onChange(formatDateTime({ ...current, h }));
                      setOpen(false);
                    }}
                    onMouseEnter={selected ? undefined : hover(true)}
                    onMouseLeave={selected ? undefined : hover(false)}
                    style={{
                      flex: "none",
                      height: 32,
                      borderRadius: 8,
                      border: 0,
                      fontFamily: "inherit",
                      fontSize: 13.5,
                      fontVariantNumeric: "tabular-nums",
                      cursor: "pointer",
                      direction: "ltr",
                      background: selected ? "var(--accent-tint)" : "transparent",
                      color: selected ? "var(--accent-ink)" : "var(--ink-2)",
                      fontWeight: selected ? 700 : 500,
                    }}
                  >
                    {pad2(h)}:00
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
