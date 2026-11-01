import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/shared/ui/Icon";
import type { Totals, UsageWindow } from "../api";
import { HE_DOW, HE_DOW_FULL } from "../model/calendar";
import { dayLabel, iNum, iPct } from "../model/format";
import { useUsageSettings } from "../settings";

export const QUIET_COLOR = "var(--c-800)";
export const WORK_COLOR = "var(--c-500)";

/** Keeps times like 09:00–21:00 left-to-right inside Hebrew text. */
export function Tm({ t }: { t: string }) {
  return <span style={{ display: "inline-block", whiteSpace: "nowrap", unicodeBidi: "isolate", direction: "ltr" }}>{t}</span>;
}

interface TrendProps {
  cur: number;
  prev: number;
  good?: "up" | "down" | "neutral";
  compact?: boolean;
}

export function Trend({ cur, prev, good = "neutral", compact = false }: TrendProps) {
  if (!prev) return compact ? null : <span className="t-cap">אין נתוני השוואה</span>;
  const change = (cur - prev) / prev;
  const up = change >= 0;
  const flat = Math.abs(change) < 0.02;
  const color = flat || good === "neutral" ? "var(--ink-3)" : up === (good === "up") ? "var(--ok)" : "var(--err)";
  return (
    <span className="row" style={{ gap: 4, fontSize: compact ? 12 : 12.5, color, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 10 }}>{flat ? "■" : up ? "▲" : "▼"}</span>
      {flat ? "ללא שינוי" : `${Math.abs(Math.round(change * 100))}%`}
      {!compact && <span style={{ fontWeight: 400, color: "var(--muted)" }}>מהתקופה הקודמת</span>}
    </span>
  );
}

interface KpiProps {
  label: string;
  value: ReactNode;
  unit?: string;
  cur?: number | null;
  prev?: number;
  good?: "up" | "down" | "neutral";
  sub?: ReactNode;
  icon?: IconName;
  accent?: string | null;
}

export function Kpi({ label, value, unit, cur, prev = 0, good, sub, icon, accent }: KpiProps) {
  return (
    <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
        <span className="t-sm" style={{ fontWeight: 600, color: "var(--ink-3)" }}>
          {label}
        </span>
        {icon && <Icon name={icon} size={16} style={{ color: accent ?? "var(--faint)" }} />}
      </div>
      <div className="row" style={{ gap: 6, alignItems: "baseline" }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums", color: accent ?? "var(--ink)" }}>{value}</span>
        {unit && (
          <span className="t-sm" style={{ color: "var(--muted)" }}>
            {unit}
          </span>
        )}
      </div>
      {cur != null && <Trend cur={cur} prev={prev} good={good} />}
      {sub && <span className="t-cap">{sub}</span>}
    </div>
  );
}

interface SegProps<T extends string | number> {
  value: T;
  options: readonly (readonly [T, string, string?])[];
  onChange: (value: T) => void;
  size?: "sm";
}

export function Seg<T extends string | number>({ value, options, onChange, size }: SegProps<T>) {
  const [tip, setTip] = useState<T | null>(null);
  return (
    <div className="row" role="radiogroup" style={{ background: "var(--n-100)", borderRadius: "var(--r-md)", padding: 3, gap: 2 }}>
      {options.map(([v, label, hint]) => (
        <div key={v} style={{ position: "relative" }} onMouseEnter={() => hint && setTip(v)} onMouseLeave={() => setTip(null)}>
          <button
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            style={{
              border: 0,
              borderRadius: 7,
              padding: size === "sm" ? "5px 10px" : "6px 12px",
              fontSize: 13,
              fontWeight: value === v ? 650 : 500,
              background: value === v ? "var(--surface)" : "transparent",
              color: value === v ? "var(--ink)" : "var(--ink-3)",
              boxShadow: value === v ? "var(--sh-xs)" : "none",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
          {tip === v && (
            <span
              role="tooltip"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--ink)",
                color: "var(--n-0)",
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 9px",
                borderRadius: 6,
                whiteSpace: "nowrap",
                zIndex: 50,
                pointerEvents: "none",
                boxShadow: "var(--sh-md)",
              }}
            >
              {hint}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: readonly (readonly [color: string, label: string])[] }) {
  return (
    <div className="row t-cap" style={{ gap: 14, flexWrap: "wrap" }}>
      {items.map(([color, label]) => (
        <span key={label} className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

const niceMax = (raw: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 4 ? 4 : normalized <= 8 ? 8 : 10) * magnitude;
};

/** Daily stacked bars: work hours on top of quiet hours, weekends shaded. */
export function UsageBars({ total, quiet, fmt, window, height = 170 }: { total: number[]; quiet: number[]; fmt: (n: number) => string; window: UsageWindow; height?: number }) {
  const { calendar } = useUsageSettings();
  const [hover, setHover] = useState<number | null>(null);
  const n = total.length;
  const max = niceMax(Math.max(1e-9, ...total));
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const ticks = [...new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1])];
  return (
    <div style={{ display: "flex", gap: 10, direction: "ltr" }}>
      <div style={{ position: "relative", width: 44, height, flex: "none" }}>
        {yTicks.map((x) => (
          <span key={x} className="t-cap" style={{ position: "absolute", right: 0, bottom: height * x, transform: "translateY(50%)", fontSize: 11, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {x ? fmt(max * x) : "0"}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ position: "relative", height, display: "flex", alignItems: "flex-end", gap: n > 60 ? 1 : n > 20 ? 3 : 8, direction: "ltr" }}
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((x) => (
            <div key={x} style={{ position: "absolute", insetInline: 0, bottom: height * x, borderTop: x ? "1px dashed var(--border-soft)" : "1px solid var(--border)", pointerEvents: "none" }} />
          ))}
          {total.map((t, i) => {
            const q = quiet[i] ?? 0;
            const work = t - q;
            const on = hover === i;
            const weekday = window.weekdays[i] ?? 0;
            return (
              <div
                key={i}
                onMouseEnter={() => setHover(i)}
                style={{
                  flex: 1,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  position: "relative",
                  background: calendar.isWorkDay(weekday) ? "transparent" : "color-mix(in oklab, var(--c-50) 55%, transparent)",
                  borderRadius: 2,
                }}
              >
                {on && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: Math.min(height - 70, (t / max) * height + 8),
                      left: "50%",
                      transform: `translateX(${i < n * 0.2 ? "-10%" : i > n * 0.8 ? "-90%" : "-50%"})`,
                      zIndex: 3,
                      background: "var(--ink)",
                      color: "var(--n-0)",
                      borderRadius: "var(--r-sm)",
                      padding: "8px 11px",
                      whiteSpace: "nowrap",
                      fontSize: 12,
                      lineHeight: 1.5,
                      direction: "rtl",
                      boxShadow: "var(--sh-md)",
                      pointerEvents: "none",
                    }}
                  >
                    <div style={{ fontWeight: 650 }}>
                      יום {HE_DOW_FULL[weekday]}, {dayLabel(window.dates[i] ?? "")}
                    </div>
                    <div>סה״כ {fmt(t)}</div>
                    <div style={{ color: "var(--c-200)" }}>בשעות עבודה {fmt(work)}</div>
                    <div style={{ color: "var(--c-100)" }}>בשעות שקטות {fmt(q)}</div>
                  </div>
                )}
                <div style={{ height: (q / max) * height, background: QUIET_COLOR, borderRadius: work ? 0 : "3px 3px 0 0", opacity: hover === null || on ? 1 : 0.5 }} />
                <div style={{ height: (work / max) * height, background: WORK_COLOR, borderRadius: "3px 3px 0 0", opacity: hover === null || on ? 1 : 0.5, order: -1 }} />
              </div>
            );
          })}
        </div>
        <div className="t-cap" style={{ position: "relative", height: 18, marginTop: 8, direction: "ltr" }}>
          {ticks.map((i) => (
            <span key={i} style={{ position: "absolute", left: `${(i / (n - 1 || 1)) * 100}%`, transform: i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>
              {i === n - 1 && window.isLatest ? "היום" : dayLabel(window.dates[i] ?? "")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Day × hour heatmap. `cells[day][hour]`. */
export function Heatmap({ cells, fmt }: { cells: number[][]; fmt: (n: number) => string }) {
  const { calendar } = useUsageSettings();
  const [hover, setHover] = useState<[number, number, number] | null>(null);
  const max = Math.max(0, ...cells.flat());
  return (
    <div style={{ direction: "rtl" }}>
      <div className="col" style={{ gap: 2, direction: "ltr" }} onMouseLeave={() => setHover(null)}>
        <div className="row" style={{ gap: 2 }}>
          <span style={{ width: 28, flex: "none" }} />
          {Array.from({ length: 24 }, (_, h) => (
            <span
              key={h}
              className="t-cap"
              style={{ flex: 1, minWidth: 0, fontSize: 10, textAlign: "center", color: calendar.isPeak(0, h) ? "var(--err)" : undefined, fontWeight: calendar.isPeak(0, h) ? 700 : 400 }}
            >
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </span>
          ))}
        </div>
        {HE_DOW.map((label, d) => (
          <div key={d} className="row" style={{ gap: 2 }}>
            <span className="t-cap" style={{ fontSize: 11, width: 28, flex: "none" }}>
              {label}
            </span>
            {Array.from({ length: 24 }, (_, h) => {
              const v = cells[d]?.[h] ?? 0;
              const k = Math.round(8 + (v / (max || 1)) * 92);
              const quiet = calendar.isQuiet(d, h);
              const on = hover?.[0] === d && hover[1] === h;
              return (
                <div
                  key={h}
                  onMouseEnter={() => setHover([d, h, v])}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 20,
                    borderRadius: 3,
                    background:
                      v < max * 0.01
                        ? quiet
                          ? "color-mix(in oklab, var(--c-50) 60%, var(--n-0))"
                          : "var(--n-50)"
                        : `color-mix(in oklab, ${quiet ? "var(--c-800)" : "var(--c-600)"} ${k}%, var(--n-0))`,
                    boxShadow: calendar.isPeak(d, h) ? "inset 0 -3px 0 var(--err)" : "none",
                    outline: on ? "2px solid var(--ink)" : "none",
                    outlineOffset: -1,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 10, gap: 12, flexWrap: "wrap", minHeight: 18 }}>
        <div className="row t-cap" style={{ gap: 14, flexWrap: "wrap" }}>
          <Legend
            items={[
              ["var(--c-600)", "שעות עבודה"],
              ["var(--c-800)", "שעות שקטות"],
            ]}
          />
          <span className="row" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--n-50)", boxShadow: "inset 0 -3px 0 var(--err)" }} />
            שעות עומס
          </span>
        </div>
        <span className="t-cap" style={{ fontWeight: 600, color: "var(--ink-2)" }}>
          {hover
            ? `${HE_DOW_FULL[hover[0]]} ${String(hover[1]).padStart(2, "0")}:00 · ${fmt(hover[2])} · ${calendar.isQuiet(hover[0], hover[1]) ? "שעה שקטה" : calendar.isPeak(hover[0], hover[1]) ? "שעת עומס" : "שעות עבודה"}`
            : "העבירו עכבר על תא לפירוט"}
        </span>
      </div>
    </div>
  );
}

export function Spark({ data, w = 88, h = 26, color = "var(--c-500)" }: { data: number[]; w?: number; h?: number; color?: string }) {
  const n = data.length;
  if (!n) return null;
  const step = n > 30 ? 7 : n > 10 ? 3 : 1;
  const points: number[] = [];
  for (let i = 0; i < n; i += step) points.push(data.slice(i, i + step).reduce((a, b) => a + b, 0));
  const max = Math.max(1e-9, ...points);
  const d = points.map((v, i) => `${(i / (points.length - 1 || 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", direction: "ltr" }} aria-hidden="true">
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Bar({ pct, color = "var(--c-400)", h = 8, bg = "var(--n-100)" }: { pct: number; color?: string; h?: number; bg?: string }) {
  return (
    <div style={{ position: "relative", height: h, borderRadius: 99, background: bg }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 99 }} />
    </div>
  );
}

export function TierBadge({ tier }: { tier: number }) {
  const { config } = useUsageSettings();
  const info = config.tiers[String(tier)];
  const tone = tier === 3 ? { background: "var(--err-bg)", color: "var(--err)" } : tier === 2 ? { background: "var(--warn-bg)", color: "#8A5E10" } : { background: "var(--ok-bg)", color: "var(--ok)" };
  return (
    <span className="badge" style={{ ...tone, fontFamily: "var(--mono)", fontSize: 11 }} title={info ? `${info.label} · ${info.hint}` : undefined}>
      {info?.sign}
    </span>
  );
}

/** Adoption funnel. No goal line in Leg 1. */
export function Funnel({ totals }: { totals: Totals }) {
  const { config } = useUsageSettings();
  const stages: [string, number, string][] = [
    ["כלל המשתמשים", totals.users, "בהיקף הנבחר"],
    ["התקינו כלי", totals.installed, "לפחות כלי קוד אחד"],
    ["שלחו בקשה ראשונה", totals.firstRequest, "אי פעם"],
    ["פעילים שבועית", totals.weeklyActive, `פעילות ב-${config.weeklyPct}% מהשבועות`],
    ["פעילים יומית", totals.dailyActive, `פעילות ב-${config.dailyPct}% מימי העבודה`],
    ["משתמשים חכמים", totals.smart, `יומיים, ${config.smartQuiet}%+ בשעות שקטות, עד ${config.smartStrong}% ב-Opus`],
  ];
  return (
    <div className="col" style={{ gap: 9 }}>
      {stages.map(([label, value, sub], i) => {
        const pct = totals.users ? value / totals.users : 0;
        const previous = i ? (stages[i - 1]?.[1] ?? 0) : null;
        const conversion = previous ? value / previous : null;
        return (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 150px) minmax(0, 1fr) 92px", gap: 12, alignItems: "center" }}>
            <div className="col" style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
              <span className="t-cap" style={{ fontSize: 11.5 }}>
                {sub}
              </span>
            </div>
            <div style={{ position: "relative", height: 26, background: "var(--n-50)", borderRadius: 6 }}>
              <div
                style={{
                  position: "absolute",
                  insetBlock: 0,
                  insetInlineStart: 0,
                  width: `${pct * 100}%`,
                  borderRadius: 6,
                  background: i === 5 ? "var(--ok)" : `color-mix(in oklab, var(--c-600) ${100 - i * 13}%, var(--c-200))`,
                }}
              />
              {conversion != null && (
                <span className="t-cap" style={{ position: "absolute", insetInlineEnd: 8, top: 5, fontSize: 11.5, color: "var(--ink-3)" }}>
                  {iPct(conversion)} מהשלב הקודם
                </span>
              )}
            </div>
            <div className="col" style={{ alignItems: "flex-end" }}>
              <span style={{ fontWeight: 700, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{iNum(value)}</span>
              <span className="t-cap">{iPct(pct)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface ShareRow {
  key: string;
  name: string;
  value: number;
  sub?: string;
  color?: string;
}

export function ShareList<R extends ShareRow>({ rows, total, fmt, lead, extra }: { rows: R[]; total: number; fmt: (n: number) => string; lead: (row: R) => ReactNode; extra?: (row: R) => ReactNode }) {
  return (
    <div className="col" style={{ gap: 14 }}>
      {rows.map((row) => {
        const pct = total ? row.value / total : 0;
        return (
          <div key={row.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) 76px", gap: 14, alignItems: "center", opacity: row.value ? 1 : 0.55 }}>
            <div className="row" style={{ gap: 10, minWidth: 0 }}>
              {lead(row)}
              <div className="col" style={{ minWidth: 0 }}>
                <span className="row" style={{ gap: 6, fontWeight: 600, fontSize: 14 }}>
                  {row.name}
                  {extra?.(row)}
                </span>
                {row.sub && (
                  <span className="t-cap" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.sub}
                  </span>
                )}
              </div>
            </div>
            <Bar pct={pct * 100} color={row.color ?? "var(--c-400)"} />
            <div className="col" style={{ alignItems: "flex-end" }}>
              <span style={{ fontWeight: 650, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{fmt(row.value)}</span>
              <span className="t-cap">{iPct(pct)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Insight({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--warn-bg)" }}>
      <Icon name="scale" size={18} style={{ color: "#8A5E10", flex: "none", marginTop: 1 }} />
      <div className="col" style={{ gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 650, fontSize: 14, color: "var(--ink)" }}>{title}</span>
        <span className="t-sm" style={{ textWrap: "pretty" }}>
          {children}
        </span>
      </div>
    </div>
  );
}

export function CardHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-start" }}>
      <div className="col" style={{ gap: 4, minWidth: 0 }}>
        <h2 className="t-h4" style={{ margin: 0 }}>
          {title}
        </h2>
        {sub && <span className="t-cap">{sub}</span>}
      </div>
      {right}
    </div>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: "#A0612A",
  OpenAI: "#3C8A5B",
  Google: "#3D6B9E",
  Meta: "#4267B2",
  Mistral: "#C0473A",
  DeepSeek: "#6B4FA0",
  Internal: "#6B6354",
};

export function ProviderDot({ provider, size = 18 }: { provider: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        background: PROVIDER_COLORS[provider] ?? "var(--ink-3)",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.5,
        fontWeight: 700,
        flex: "none",
      }}
    >
      {provider.charAt(0)}
    </span>
  );
}
