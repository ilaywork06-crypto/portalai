import { Fragment, useState, type CSSProperties } from "react";
import { Icon, iconOr } from "@/shared/ui/Icon";
import type { Metric, ModelUsage, Series, UsageWindow } from "../api";
import { daysLabel, HE_DOW_FULL, spanLabel } from "../model/calendar";
import { dayLabel, iMoney, iNum, iPct, iShort, iTok, metricFormat } from "../model/format";
import { useUsageSettings } from "../settings";
import { Bar, CardHead, Insight, Legend, ProviderDot, QUIET_COLOR, Seg, ShareList, TierBadge, Tm, UsageBars, WORK_COLOR, type ShareRow } from "./charts";

export const card: CSSProperties = { padding: 24 };
export const grid = (columns: string, gap = 18): CSSProperties => ({ display: "grid", gridTemplateColumns: columns, gap });
const METRICS: readonly (readonly [Metric, string])[] = [
  ["req", "בקשות"],
  ["tok", "טוקנים"],
  ["cost", "עלות"],
];

function QuietHoursNote() {
  const { config, calendar } = useUsageSettings();
  return (
    <span className="row t-cap" style={{ gap: 6 }}>
      <Icon name="moon" size={13} style={{ color: "var(--c-800)" }} />
      <span>
        שעות שקטות: מחוץ ל-<Tm t={spanLabel(config.workStart, config.workEnd)} /> בימי העבודה, וכל יום {daysLabel(calendar.offDays(), true)}
      </span>
    </span>
  );
}

export function ToolIcons({ tools }: { tools: string[] }) {
  const { toolById } = useUsageSettings();
  if (!tools.length) return <span className="t-cap">—</span>;
  return (
    <span className="row" style={{ gap: 3 }}>
      {tools.map((id) => {
        const tool = toolById(id);
        return (
          <span key={id} title={tool?.name} style={{ width: 22, height: 22, borderRadius: 6, background: "var(--accent-tint)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
            <Icon name={iconOr(tool?.icon ?? "")} size={13} />
          </span>
        );
      })}
    </span>
  );
}

const pick = (series: Series, metric: Metric): [number[], number[]] =>
  metric === "req" ? [series.requests, series.quietRequests] : metric === "tok" ? [series.tokens, series.quietTokens] : [series.cost, series.quietCost];

interface UsageOverTimeProps {
  series: Series;
  window: UsageWindow;
  metric: Metric;
  setMetric: (metric: Metric) => void;
  title: string;
}

export function UsageOverTime({ series, window, metric, setMetric, title }: UsageOverTimeProps) {
  const [total, quiet] = pick(series, metric);
  const fmt = metricFormat[metric];
  const peakDay = total.reduce((best, value, i) => (value > (total[best] ?? 0) ? i : best), 0);
  const sum = total.reduce((a, b) => a + b, 0);
  const quietSum = quiet.reduce((a, b) => a + b, 0);
  return (
    <div className="card" style={card}>
      <CardHead
        title={title}
        sub={
          <Legend
            items={[
              [WORK_COLOR, `שעות עבודה · ${fmt(sum - quietSum)}`],
              [QUIET_COLOR, `שעות שקטות · ${fmt(quietSum)}`],
              ["color-mix(in oklab, var(--c-50) 55%, transparent)", "סופ״ש"],
            ]}
          />
        }
        right={<Seg value={metric} onChange={setMetric} options={METRICS} size="sm" />}
      />
      <UsageBars total={total} quiet={quiet} fmt={fmt} window={window} />
      {sum > 0 && (
        <div className="row t-cap" style={{ gap: 18, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
          <span>
            ממוצע יומי <b style={{ color: "var(--ink)" }}>{fmt(sum / window.days)}</b>
          </span>
          <span>
            יום שיא{" "}
            <b style={{ color: "var(--ink)" }}>
              {dayLabel(window.dates[peakDay] ?? "")} · {fmt(total[peakDay] ?? 0)}
            </b>
          </span>
          <span>
            שימוש בשעות השקטות <b style={{ color: "var(--c-800)" }}>{fmt(quietSum)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

interface ModelRow extends ShareRow {
  tokens: number;
  provider: string;
  tier: number;
  enabled: boolean;
}

const tierColor = (tier: number) => (tier === 3 ? "var(--err)" : tier === 2 ? "var(--warn)" : "var(--ok)");

export function ModelsCard({ byModel, totalCost, title = "לפי מודל" }: { byModel: ModelUsage[]; totalCost: number; title?: string }) {
  const { config } = useUsageSettings();
  const models = config.models;
  const usageOf = (id: string) => byModel.find((u) => u.modelId === id);
  const rows: ModelRow[] = models
    .map((m) => {
      const usage = usageOf(m.id);
      return {
        key: m.id,
        name: m.name,
        value: usage?.cost ?? 0,
        tokens: usage?.tokens ?? 0,
        provider: m.provider,
        tier: m.tier,
        enabled: m.enabled,
        sub: `$${m.input} / $${m.output} למיליון טוקנים (קלט/פלט)`,
        color: tierColor(m.tier),
      };
    })
    .sort((a, b) => b.value - a.value);
  const tierTokens = [1, 2, 3].map((tier) => models.reduce((sum, m) => sum + (m.tier === tier ? (usageOf(m.id)?.tokens ?? 0) : 0), 0));
  const tokenTotal = tierTokens.reduce((a, b) => a + b, 0) || 1;
  const premium = (tierTokens[2] ?? 0) / tokenTotal;
  const standardRate = models.find((m) => m.tier === 2)?.blended ?? 0;
  const savings = models.reduce((sum, m) => sum + (m.tier === 3 ? ((usageOf(m.id)?.tokens ?? 0) * 0.5 * (m.blended - standardRate)) / 1e6 : 0), 0);
  return (
    <div className="card" style={card}>
      <CardHead title={title} sub="המחיר משתנה מאוד בין מודלים — הצבע מסמן את רמת המחיר" />
      <div style={{ marginBottom: 18 }}>
        <div className="row" style={{ height: 12, borderRadius: 99, overflow: "hidden", gap: 2 }}>
          {[3, 2, 1].map((tier) => (
            <div key={tier} style={{ width: `${((tierTokens[tier - 1] ?? 0) / tokenTotal) * 100}%`, height: "100%", background: tierColor(tier) }} />
          ))}
        </div>
        <div className="row t-cap" style={{ gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          {[3, 2, 1].map((tier) => (
            <span key={tier} className="row" style={{ gap: 6 }}>
              <TierBadge tier={tier} /> {config.tiers[String(tier)]?.label} · {iPct((tierTokens[tier - 1] ?? 0) / tokenTotal)} מהטוקנים
            </span>
          ))}
        </div>
      </div>
      <ShareList
        rows={rows}
        total={totalCost}
        fmt={iMoney}
        lead={(row) => <ProviderDot provider={row.provider} size={28} />}
        extra={(row) => (
          <>
            <TierBadge tier={row.tier} />
            {!row.enabled && <span className="badge">לא מונגש</span>}
          </>
        )}
      />
      {premium > 0.55 && (
        <div style={{ marginTop: 18 }}>
          <Insight title={`${iPct(premium)} מהטוקנים הלכו למודלי פרימיום`}>
            מודל פרימיום מתאים לבעיות קשות, כמו ארכיטקטורה ובאגים עמוקים. טסטים, תיעוד, rename ושינויים קטנים עובדים מצוין גם ב-Sonnet או ב-Haiku, בעלות נמוכה פי 5 עד 20.
            {savings > 1 && (
              <>
                {" "}
                העברה של חצי מהעבודה הזו למודל סטנדרט הייתה חוסכת כ-<b>{iMoney(savings)}</b> בתקופה הזו.
              </>
            )}
          </Insight>
        </div>
      )}
    </div>
  );
}

/** Quiet-hours share, with no goal marker in Leg 1. */
export function QuietHoursCoach({ share, self = false }: { share: number; self?: boolean }) {
  return (
    <div className="card" style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
      <CardHead title="שימוש חכם: שעות שקטות" sub={<QuietHoursNote />} />
      <div>
        <div className="row" style={{ gap: 8, alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 24, color: "var(--c-800)" }}>{iPct(share)}</span>
          <span className="t-sm">{self ? "מהשימוש שלך" : "מהשימוש"} בשעות שקטות</span>
        </div>
        <div style={{ position: "relative", paddingBottom: 22 }}>
          <Bar pct={share * 100} color="var(--c-800)" h={10} />
        </div>
      </div>
      <div style={{ padding: 16, borderRadius: "var(--r-md)", background: "var(--c-50)" }}>
        <div className="row" style={{ gap: 8, fontWeight: 650, fontSize: 14 }}>
          <Icon name="clock" size={16} style={{ color: "var(--c-800)" }} /> משימה כבדה? הריצו אותה בשעות השקטות
        </div>
        <ul className="t-sm" style={{ margin: "8px 0 0", paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 3 }}>
          <li>refactor רחב או migration על כל ה-repo</li>
          <li>כתיבה והרצה של סוויטת טסטים מלאה</li>
          <li>סוכנים ארוכים שרצים לבד ותיעוד אוטומטי</li>
        </ul>
        <p className="t-cap" style={{ margin: "10px 0 0", color: "var(--ink-3)" }}>
          בשעות השקטות השירות פנוי יותר: פחות חסימות, תשובות מהירות יותר, ולא מתחרים בשאר הארגון על אותה קיבולת.
        </p>
      </div>
    </div>
  );
}

function HourBars({ load, fmt, height = 120 }: { load: number[]; fmt: (n: number) => string; height?: number }) {
  const { calendar } = useUsageSettings();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1e-9, ...load);
  const color = (hour: number) => (calendar.isPeak(0, hour) ? "var(--err)" : calendar.isQuiet(0, hour) ? "var(--c-800)" : "var(--c-300)");
  return (
    <div>
      <div className="row" style={{ height, alignItems: "flex-end", gap: 3, direction: "ltr" }} onMouseLeave={() => setHover(null)}>
        {load.map((v, h) => (
          <div
            key={h}
            onMouseEnter={() => setHover(h)}
            style={{ flex: 1, height: Math.max(3, (v / max) * height), borderRadius: "3px 3px 0 0", background: color(h), opacity: hover === null || hover === h ? 1 : 0.45 }}
          />
        ))}
      </div>
      <div className="row" style={{ gap: 3, marginTop: 6, direction: "ltr" }}>
        {load.map((_, h) => (
          <span key={h} className="t-cap" style={{ flex: 1, minWidth: 0, fontSize: 10, textAlign: "center" }}>
            {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 10, minHeight: 18 }}>
        <Legend
          items={[
            ["var(--err)", "שעות עומס"],
            ["var(--c-300)", "שעות עבודה"],
            ["var(--c-800)", "שעות שקטות"],
          ]}
        />
        {hover !== null && (
          <span className="t-cap" style={{ fontWeight: 600, color: "var(--ink-2)" }}>
            {String(hover).padStart(2, "0")}:00 · {fmt(load[hover] ?? 0)}
          </span>
        )}
      </div>
    </div>
  );
}

export function MyHoursCard({ hourly, weekday, self }: { hourly: number[]; weekday: number[]; self: boolean }) {
  const max = Math.max(1e-9, ...weekday);
  return (
    <div className="card" style={card}>
      <CardHead title={self ? "מתי אני עובד עם AI" : "מתי עובדים עם AI"} sub="שימוש ממוצע לפי שעה ביום בתקופה" />
      <HourBars load={hourly} fmt={iShort} />
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
        <span className="t-cap" style={{ fontWeight: 600 }}>
          לפי יום בשבוע
        </span>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          {weekday.map((v, d) => (
            <div key={d} className="col" style={{ flex: 1, gap: 4, alignItems: "center" }}>
              <div style={{ width: "100%", height: 6, borderRadius: 99, background: "var(--n-100)" }}>
                <div style={{ width: `${(v / max) * 100}%`, height: "100%", borderRadius: 99, background: d >= 5 ? "var(--c-800)" : "var(--c-500)" }} />
              </div>
              <span className="t-cap" style={{ fontSize: 11 }}>
                {HE_DOW_FULL[d]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The org's load, for context, with one neutral sentence about the viewer's own peak-hours share. */
export function OrgLoadCard({ orgHourly, orgDaily, peakShare, hasUsage, self }: { orgHourly: number[]; orgDaily: number; peakShare: number; hasUsage: boolean; self: boolean }) {
  const { config } = useUsageSettings();
  return (
    <div className="card" style={card}>
      <CardHead title="מתי הארגון עמוס" sub={`${iNum(orgDaily)} משתמשים יומיים בארגון · עומס ממוצע לפי שעה`} />
      <HourBars load={orgHourly} fmt={iShort} />
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
        <div className="row t-sm" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="dot" style={{ background: "var(--err)" }} />
          <span>
            השעות העמוסות בארגון:{" "}
            {config.peaks.map(([a, b], i) => (
              <Fragment key={i}>
                {i ? " ו-" : ""}
                <b>
                  <Tm t={spanLabel(a, b)} />
                </b>
              </Fragment>
            ))}
          </span>
        </div>
        {hasUsage && (
          <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 14, padding: "12px 16px", borderRadius: "var(--r-md)", background: "var(--n-25)", border: "1px solid var(--border-soft)" }}>
            <Icon name="clock" size={17} style={{ color: "var(--ink-3)", flex: "none" }} />
            <span style={{ fontWeight: 650, fontSize: 14 }}>
              {iPct(peakShare)} מהשימוש {self ? "שלך" : ""} נופל בשעות העמוסות
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const PIE_COLORS = ["var(--c-800)", "var(--c-600)", "var(--c-400)", "var(--c-300)", "var(--c-200)", "var(--n-300)", "var(--n-200)"];
const PIE_SLICES = 6;

/** Token split by child unit, or by user when the unit has a single child (or none). */
export function TokenPie({ slices, byChildren, childLevel, nodeName, totalTokens }: { slices: { name: string; tokens: number }[]; byChildren: boolean; childLevel: string | null; nodeName: string; totalTokens: number }) {
  let rows = slices.filter((s) => s.tokens > 0).sort((a, b) => b.tokens - a.tokens);
  const total = rows.reduce((t, r) => t + r.tokens, 0) || 1;
  if (rows.length > PIE_SLICES) {
    const rest = rows.slice(PIE_SLICES - 1);
    rows = [...rows.slice(0, PIE_SLICES - 1), { name: `אחרים (${rest.length})`, tokens: rest.reduce((t, r) => t + r.tokens, 0) }];
  }
  let angle = 0;
  const stops = rows
    .map((row, i) => {
      const from = angle;
      angle += (row.tokens / total) * 360;
      return `${PIE_COLORS[i] ?? ""} ${from}deg ${angle}deg`;
    })
    .join(", ");
  return (
    <div className="card" style={card}>
      <CardHead title="התפלגות טוקנים" sub={`${byChildren ? `לפי ${childLevel ?? "יחידה"}` : "לפי משתמש"} · ${nodeName}`} />
      <div className="row" style={{ gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 150, height: 150, flex: "none", borderRadius: "50%", background: `conic-gradient(${stops})` }}>
          <div style={{ position: "absolute", inset: 30, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", textAlign: "center" }}>
            <div className="col" style={{ alignItems: "center" }}>
              <b style={{ fontSize: 17 }}>{iTok(totalTokens)}</b>
              <span className="t-cap">טוקנים</span>
            </div>
          </div>
        </div>
        <div className="col grow" style={{ gap: 9, minWidth: 160 }}>
          {rows.map((row, i) => (
            <div key={row.name} className="row" style={{ gap: 9 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i], flex: "none" }} />
              <span className="t-sm grow" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>
                {row.name}
              </span>
              <span className="t-cap" style={{ fontVariantNumeric: "tabular-nums" }}>
                {iTok(row.tokens)}
              </span>
              <b style={{ fontSize: 13, width: 40, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{iPct(row.tokens / total)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
