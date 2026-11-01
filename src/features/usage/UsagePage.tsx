import { Fragment, useEffect, useState } from "react";
import { useIdentity } from "@/features/auth/session";
import { errorMessage, isStatus } from "@/shared/api/errors";
import { ErrorState, Skeleton } from "@/shared/ui/States";
import { useMyUsage, useNodeUsage, useScopes, useUsageConfig, type Metric, type UsageConfig, type UsageWindow } from "./api";
import { card } from "./components/cards";
import { Seg, Tm } from "./components/charts";
import { DateTimePick } from "./components/DateTimePick";
import { MeView } from "./components/MeView";
import { ScopeView } from "./components/ScopeView";
import { daysLabel, spanLabel } from "./model/calendar";
import { addDays, at, shortcuts } from "./model/dates";
import { dayLabel, pad2 } from "./model/format";
import { UsageSettingsProvider } from "./settings";
import { useUsageView, type RangeChoice } from "./useUsageView";

const RANGES: readonly (readonly [RangeChoice, string])[] = [
  [7, "7 ימים"],
  [30, "30 יום"],
  [90, "90 יום"],
  ["custom", "טווח מותאם"],
];

/** Usage insights for coding tools: reflection only (no goals, no comparisons between people). */
export function UsagePage() {
  const config = useUsageConfig();
  if (config.isError) {
    return (
      <div className="wrap" style={{ paddingTop: 20, maxWidth: 1280 }}>
        <ErrorState onRetry={() => void config.refetch()} />
      </div>
    );
  }
  if (!config.data) return <div className="wrap" style={{ paddingTop: 20, paddingBottom: 80, maxWidth: 1280, minHeight: "70vh" }} />;
  return (
    <UsageSettingsProvider config={config.data}>
      <UsageScreen config={config.data} />
    </UsageSettingsProvider>
  );
}

function UsageScreen({ config }: { config: UsageConfig }) {
  const identity = useIdentity();
  const canManage = identity.managedNodeIds.length > 0;
  const scopes = useScopes(canManage);
  const scope = scopes.data?.[0] ?? null;
  const last = config.data.last;
  const view = useUsageView({
    canManage,
    scopeRoot: scope?.id ?? identity.managedNodeIds[0] ?? null,
    data: config.data,
    defaultCustom: { from: at(addDays(last, -13), 9), to: at(last, 18) },
  });
  const [metric, setMetric] = useState<Metric>("req");
  const tabs = [["me", "ה-AI שלי", null] as const, ...(canManage ? [["under", "ה-AI תחתיי", scope?.users ?? null] as const] : [])];
  const tabTitle = tabs.find(([id]) => id === view.tab)?.[1];

  const me = useMyUsage(view.period, view.tab === "me");
  const node = useNodeUsage(view.tab === "under" ? view.nodeId : null, view.period);
  const window: UsageWindow | undefined = view.tab === "me" ? me.data?.window : node.data?.window;

  useEffect(() => {
    if (view.tab === "under" && (isStatus(node.error, 403) || isStatus(node.error, 404))) view.resetScope();
  }, [view, node.error]);

  return (
    <div className="route-fade wrap" style={{ paddingTop: 20, paddingBottom: 80, maxWidth: 1280 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <span className="t-eyebrow">תובנות שימוש · כלי קוד</span>
          </div>
          <h1 className="t-h1" style={{ marginTop: 10 }}>
            {tabTitle}
          </h1>
          <p className="t-body" style={{ fontSize: 15.5, color: "var(--ink-3)", marginTop: 6, maxWidth: 640, textWrap: "pretty" }}>
            {view.tab === "me"
              ? "נתוני השימוש שלי בכלי הקוד: כמה, מתי, באילו מודלים, ואיך להשתמש בצורה חכמה יותר."
              : "נתוני השימוש בכלי הקוד בהיררכיה שבניהולי: מי משתמש, כמה, באילו מודלים, ואיפה כדאי להעמיק."}
          </p>
        </div>
      </div>

      <div className="row" role="tablist" style={{ gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 18, overflowX: "auto", overflowY: "hidden" }}>
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view.tab === id}
            onClick={() => view.setTab(id)}
            className="row"
            style={{
              gap: 8,
              border: 0,
              background: "none",
              padding: "12px 14px",
              fontSize: 15,
              fontWeight: view.tab === id ? 700 : 500,
              color: view.tab === id ? "var(--ink)" : "var(--ink-3)",
              borderBottom: `2.5px solid ${view.tab === id ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {label}
            {count != null && (
              <span className="badge" style={{ background: view.tab === id ? "var(--accent-soft)" : "var(--n-100)", color: view.tab === id ? "var(--accent-ink)" : "var(--ink-3)" }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 20, justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Seg value={view.range} onChange={view.setRange} options={RANGES} />
          <Seg
            value={view.hours}
            onChange={view.setHours}
            options={[
              ["all", "כל השעות"],
              ["work", "שעות עבודה", `${daysLabel(config.workDays, true)} · ${spanLabel(config.workStart, config.workEnd)}`],
            ]}
          />
          <Seg
            value={view.days}
            onChange={view.setDays}
            options={[
              ["all", "כל הימים"],
              ["work", "ימי עבודה", daysLabel(config.workDays, true)],
            ]}
          />
        </div>
        {window && <RangeSummary window={window} custom={view.range === "custom" && !view.customInvalid} under={view.tab === "under"} />}
      </div>

      {view.range === "custom" && (
        <div className="card row" style={{ gap: 14, flexWrap: "wrap", alignItems: "flex-end", padding: "14px 18px", marginTop: -8, marginBottom: 20 }}>
          {(
            [
              ["from", "מתאריך ושעה"],
              ["to", "עד תאריך ושעה"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="col" style={{ gap: 5 }}>
              <span className="t-cap" style={{ fontWeight: 600 }}>
                {label}
              </span>
              <DateTimePick
                value={view.custom[key]}
                min={at(config.data.first, 0)}
                max={at(last, 23)}
                invalid={view.customInvalid}
                label={label}
                onChange={(value) => view.setCustom({ ...view.custom, [key]: value })}
              />
            </div>
          ))}
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {shortcuts(last).map(([label, from, to]) => (
              <button key={label} className="chip" style={{ whiteSpace: "nowrap" }} onClick={() => view.setCustom({ from, to })}>
                {label}
              </button>
            ))}
          </div>
          <span className="t-cap" role={view.customInvalid ? "alert" : undefined} style={{ color: view.customInvalid ? "var(--err)" : "var(--muted)", flex: "1 1 200px" }}>
            {view.customInvalid
              ? "תאריך הסיום צריך להיות אחרי תאריך ההתחלה."
              : window && `${window.days} ${window.days === 1 ? "יום" : "ימים"} · נתונים זמינים מ-${dayLabel(config.data.first)}`}
          </span>
        </div>
      )}

      {view.tab === "me" &&
        (me.data ? (
          <MeView report={me.data} workHoursOnly={view.hours === "work"} metric={metric} setMetric={setMetric} />
        ) : me.isError ? (
          isStatus(me.error, 404) ? (
            <div className="card" style={{ ...card, textAlign: "center" }}>
              <p className="t-body">עוד לא התחלת להשתמש בכלי קוד.</p>
            </div>
          ) : (
            <ErrorState message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
          )
        ) : (
          <MeSkeleton />
        ))}
      {view.tab === "under" && view.nodeId && (
        <ScopeView nodeId={view.nodeId} userId={view.userId} period={view.period} metric={metric} setMetric={setMetric} onNode={view.goNode} onUser={view.openUser} />
      )}

      <div className="col t-cap" style={{ marginTop: 28, alignItems: "center", gap: 4, textAlign: "center" }}>
        <span>״בהשוואה לבחוץ״: כמה השימוש היה עולה לפי מחירון הספקים ($ למיליון טוקנים), בלי הנחות</span>
        <span>
          שעות עבודה: {daysLabel(config.workDays)} <Tm t={spanLabel(config.workStart, config.workEnd)} /> · שעות עומס:{" "}
          {config.peaks.map(([a, b], i) => (
            <Fragment key={i}>
              {i ? " ו-" : ""}
              <Tm t={spanLabel(a, b)} />
            </Fragment>
          ))}{" "}
          · שעות שקטות: כל השאר
        </span>
        <span>הנתונים מתעדכנים פעם בשעה</span>
      </div>
    </div>
  );
}

function RangeSummary({ window, custom, under }: { window: UsageWindow; custom: boolean; under: boolean }) {
  return (
    <span className="t-cap">
      {custom ? (
        <span style={{ direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>
          {dayLabel(window.start)} {pad2(window.startHour)}:00 – {dayLabel(window.end)} {pad2(window.endHour)}:00
        </span>
      ) : (
        <>
          {dayLabel(window.start)} – {dayLabel(window.end)}
        </>
      )}{" "}
      · מושווה ל-{window.days} {window.days === 1 ? "יום" : "הימים"} שלפני{under ? " · ההיררכיה שבניהולך" : ""}
    </span>
  );
}

function MeSkeleton() {
  return (
    <div className="col" style={{ gap: 18 }} aria-busy="true">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={128} />
        ))}
      </div>
      <Skeleton height={330} />
    </div>
  );
}
