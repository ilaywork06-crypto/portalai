import { Fragment, useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { Icon } from "@/shared/ui/Icon";
import { ErrorState, Skeleton } from "@/shared/ui/States";
import { useMemberUsage, useNodeUsage, type ChildRow, type Metric, type NodeReport, type Period, type UserRow } from "../api";
import { iMoney, iPct, iShort, iTok } from "../model/format";
import { useUsageSettings } from "../settings";
import { card, grid, ModelsCard, QuietHoursCoach, TokenPie, ToolIcons, UsageOverTime } from "./cards";
import { Bar, CardHead, Funnel, Heatmap, Kpi, Spark, Trend } from "./charts";
import { MeView } from "./MeView";
import { SortTable, type Column, type SortState } from "./SortTable";

interface ScopeViewProps {
  nodeId: string;
  userId: string | null;
  period: Period;
  metric: Metric;
  setMetric: (metric: Metric) => void;
  onNode: (nodeId: string) => void;
  onUser: (userId: string, teamId: string) => void;
}

export function ScopeView({ nodeId, userId, period, metric, setMetric, onNode, onUser }: ScopeViewProps) {
  const node = useNodeUsage(nodeId, period);
  const member = useMemberUsage(userId, period);
  const report = node.data;
  const openUser = (row: { id: string; teamId: string }) => {
    onUser(row.id, row.teamId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (node.isError) return <ErrorState message={errorMessage(node.error)} onRetry={() => void node.refetch()} />;
  if (!report) return <ScopeSkeleton />;
  const { node: unit } = report;
  const userName = member.data?.member.name;

  return (
    <div className="col stagger" style={{ gap: 18 }}>
      <nav className="row" aria-label="היררכיה" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {unit.path.map((n, i) => {
          const current = n.id === unit.id && !userId;
          return (
            <Fragment key={n.id}>
              {i > 0 && <Icon name="chevronRight" size={14} style={{ color: "var(--faint)" }} />}
              <button
                onClick={() => onNode(n.id)}
                aria-current={current ? "page" : undefined}
                className="row"
                style={{
                  gap: 6,
                  border: 0,
                  background: current ? "var(--ink)" : "var(--n-100)",
                  color: current ? "var(--n-0)" : "var(--ink-2)",
                  padding: "5px 11px",
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span style={{ opacity: 0.65, fontWeight: 500 }}>{n.levelName}</span>
                {n.name}
              </button>
            </Fragment>
          );
        })}
        {userId && userName && (
          <>
            <Icon name="chevronRight" size={14} style={{ color: "var(--faint)" }} />
            <span className="row" aria-current="page" style={{ gap: 6, background: "var(--ink)", color: "var(--n-0)", padding: "5px 11px", borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
              <span style={{ opacity: 0.65, fontWeight: 500 }}>יוזר</span>
              {userName}
            </span>
          </>
        )}
        {!userId && unit.childLevelName && (
          <span className="t-cap" style={{ marginInlineStart: 8 }}>
            · {unit.children.length} {unit.childLevelName} · {report.current.users} משתמשים
          </span>
        )}
      </nav>
      {!userId && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: -8 }}>
          <span className="t-cap" style={{ fontWeight: 600 }}>
            צלילה ל{unit.children[0]?.levelName ?? "יוזר"}:
          </span>
          {unit.children.length > 0
            ? unit.children.map((child) => (
                <button key={child.id} className="chip" onClick={() => onNode(child.id)}>
                  <Icon name="chevronRight" size={12} />
                  {child.name}
                </button>
              ))
            : unit.members.map((m) => (
                <button key={m.id} className="chip" onClick={() => openUser({ id: m.id, teamId: unit.id })}>
                  <Icon name="chevronRight" size={12} />
                  {m.name}
                </button>
              ))}
        </div>
      )}

      {userId ? (
        member.data ? (
          <>
            <div className="row" style={{ gap: 14 }}>
              <span
                style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 18, flex: "none" }}
              >
                {member.data.member.name.charAt(0)}
              </span>
              <div className="col" style={{ minWidth: 0 }}>
                <span className="t-h3">{member.data.member.name}</span>
                <span className="t-cap">
                  {member.data.member.role} · {member.data.member.unitPath.join(" › ")}
                </span>
              </div>
            </div>
            <MeView report={member.data} workHoursOnly={period.hours === "work"} metric={metric} setMetric={setMetric} self={false} />
          </>
        ) : member.isError ? (
          <ErrorState message={errorMessage(member.error)} onRetry={() => void member.refetch()} />
        ) : (
          <Skeleton height={420} />
        )
      ) : (
        <UnitReport report={report} period={period} metric={metric} setMetric={setMetric} onNode={onNode} onUser={openUser} />
      )}
    </div>
  );
}

function UnitReport({
  report,
  period,
  metric,
  setMetric,
  onNode,
  onUser,
}: {
  report: NodeReport;
  period: Period;
  metric: Metric;
  setMetric: (m: Metric) => void;
  onNode: (id: string) => void;
  onUser: (row: UserRow) => void;
}) {
  const { config } = useUsageSettings();
  const [childSort, setChildSort] = useState<SortState>(["cost", true]);
  const [userSort, setUserSort] = useState<SortState>(["cost", true]);
  const [query, setQuery] = useState("");
  const { node: unit, current, previous } = report;
  useEffect(() => {
    setQuery("");
  }, [unit.id]);
  const dailyShare = current.users ? current.dailyActive / current.users : 0;
  const quietHidden = period.hours === "work";

  const childColumns = useMemo<Column<ChildRow>[]>(
    () => [
      {
        key: "name",
        label: unit.children[0]?.levelName ?? "",
        render: (r) => (
          <span className="row" style={{ gap: 8, fontWeight: 600 }}>
            {r.name}
            <Icon name="chevronLeft" size={14} style={{ color: "var(--faint)" }} />
          </span>
        ),
      },
      { key: "n", label: "משתמשים", numeric: true, value: (r) => r.users, render: (r) => r.users },
      {
        key: "inst",
        label: "התקינו",
        value: (r) => r.installed / r.users,
        render: (r) => (
          <div className="row" style={{ gap: 8, width: 110 }}>
            <div style={{ flex: 1 }}>
              <Bar pct={(r.installed / r.users) * 100} h={6} />
            </div>
            <span className="t-cap" style={{ width: 32 }}>
              {iPct(r.installed / r.users)}
            </span>
          </div>
        ),
      },
      {
        key: "daily",
        label: "פעילים יומית",
        value: (r) => r.dailyActive / r.users,
        render: (r) => (
          <div className="row" style={{ gap: 8, width: 120 }}>
            <div style={{ flex: 1 }}>
              <Bar pct={(r.dailyActive / r.users) * 100} h={6} color="var(--c-600)" />
            </div>
            <span className="t-cap" style={{ width: 32, color: "var(--muted)", fontWeight: 600 }}>
              {iPct(r.dailyActive / r.users)}
            </span>
          </div>
        ),
      },
      { key: "cost", label: "עלות", numeric: true, value: (r) => r.cost, render: (r) => <b>{iMoney(r.cost)}</b> },
      {
        key: "share",
        label: "חלק מההוצאה",
        value: (r) => r.cost,
        render: (r) => (
          <div className="row" style={{ gap: 8, width: 100 }}>
            <div style={{ flex: 1 }}>
              <Bar pct={(r.cost / (current.cost || 1)) * 100} h={6} color="var(--c-400)" />
            </div>
            <span className="t-cap" style={{ width: 30 }}>
              {iPct(r.cost / (current.cost || 1))}
            </span>
          </div>
        ),
      },
      { key: "cpa", label: "עלות לפעיל", numeric: true, value: (r) => r.cost / (r.active || 1), render: (r) => iMoney(r.cost / (r.active || 1)) },
      {
        key: "quiet",
        label: "שקטות",
        numeric: true,
        value: (r) => r.quietShare,
        render: (r) => <span style={{ color: "var(--c-800)", fontWeight: 600 }}>{iPct(r.quietShare)}</span>,
      },
      {
        key: "trend",
        label: "מגמה",
        value: (r) => (r.previousCost ? r.cost / r.previousCost : 0),
        render: (r) => (
          <span className="row" style={{ gap: 8 }}>
            <Spark data={r.costSeries} w={70} h={22} />
            <Trend cur={r.cost} prev={r.previousCost} compact />
          </span>
        ),
      },
    ],
    [unit.children, current.cost],
  );

  const userColumns = useMemo<Column<UserRow>[]>(
    () => [
      { key: "rank", label: "#", render: (_r, i) => <span className="t-cap">{i + 1}</span> },
      {
        key: "name",
        label: "משתמש",
        render: (r) => (
          <div className="row" style={{ gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: r.isMe ? "var(--accent)" : "var(--n-150)",
                color: r.isMe ? "#fff" : "var(--ink-2)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 12.5,
                flex: "none",
              }}
            >
              {r.name.charAt(0)}
            </span>
            <div className="col">
              <span style={{ fontWeight: 600 }}>
                {r.name}
                {r.isMe && <span className="t-cap"> (את/ה)</span>}
              </span>
              <span className="t-cap">
                {r.role} · {r.teamName}
                {unit.level < 4 ? ` · ${r.sectionName}` : ""}
              </span>
            </div>
          </div>
        ),
      },
      { key: "tools", label: "כלים", render: (r) => <ToolIcons tools={r.tools} /> },
      {
        key: "act",
        label: "ימים פעילים",
        numeric: true,
        value: (r) => r.activeDays,
        render: (r) => (
          <span>
            {r.activeDays}
            <span className="t-cap">/{r.eligibleDays}</span>
          </span>
        ),
      },
      { key: "req", label: "בקשות", numeric: true, value: (r) => r.requests, render: (r) => iShort(r.requests) },
      { key: "tok", label: "טוקנים", numeric: true, value: (r) => r.tokens, render: (r) => iTok(r.tokens) },
      { key: "cost", label: "עלות", numeric: true, value: (r) => r.cost, render: (r) => <b>{iMoney(r.cost)}</b> },
      {
        key: "off",
        label: "שקטות",
        numeric: true,
        value: (r) => (r.requests ? r.quietRequests / r.requests : 0),
        render: (r) => <span style={{ color: "var(--c-800)" }}>{r.requests ? iPct(r.quietRequests / r.requests) : "—"}</span>,
      },
      {
        key: "opus",
        label: "Opus",
        numeric: true,
        value: (r) => r.strongShare,
        render: (r) =>
          r.activeDays ? <span style={{ color: r.strongShare > config.premiumWarn / 100 ? "var(--err)" : "var(--ink-2)" }}>{iPct(r.strongShare)}</span> : "—",
      },
      {
        key: "trend",
        label: "מגמה",
        value: (r) => (r.previousCost ? r.cost / r.previousCost : 0),
        render: (r) =>
          !r.activeDays ? (
            <span className="t-cap">{!r.tools.length ? "לא התקין" : "לא פעיל"}</span>
          ) : (
            <span className="row" style={{ gap: 8 }}>
              <Spark data={r.dailyRequests} w={60} h={20} />
              <Trend cur={r.cost} prev={r.previousCost} compact />
            </span>
          ),
      },
    ],
    [unit.level, config.premiumWarn],
  );

  const users = query ? report.users.filter((r) => r.name.includes(query)) : report.users;
  const byChildren = report.children.length > 1;
  const slices = byChildren ? report.children.map((c) => ({ name: c.name, tokens: c.tokens })) : report.users.map((u) => ({ name: u.name, tokens: u.tokens }));

  return (
    <>
      <div style={grid("repeat(auto-fit, minmax(200px, 1fr))", 14)}>
        <Kpi label="בקשות" value={iShort(current.requests)} cur={current.requests} prev={previous.requests} icon="send" />
        <Kpi label="טוקנים" value={iTok(current.tokens)} cur={current.tokens} prev={previous.tokens} icon="type" />
        <Kpi label="בהשוואה לבחוץ" value={iMoney(current.cost)} cur={current.cost} prev={previous.cost} icon="wallet" sub="לפי מחירון הספקים" />
        <Kpi label="פעילים יומית" value={iPct(dailyShare)} cur={current.dailyActive} prev={previous.dailyActive} good="up" icon="users" sub={`${current.dailyActive} מתוך ${current.users}`} />
        <Kpi
          label="בשעות שקטות"
          value={quietHidden ? "—" : iPct(current.quietShare)}
          cur={quietHidden ? null : current.quietShare}
          prev={previous.quietShare}
          good="up"
          icon="moon"
          accent="var(--c-800)"
          sub={quietHidden ? "לא מוצג בסינון שעות עבודה" : "מהבקשות"}
        />
      </div>

      <div style={grid("minmax(0, 1.45fr) minmax(0, 1fr)")}>
        <div className="card" style={card}>
          <CardHead title="משפך אימוץ" sub={`מההרשאה ועד שימוש חכם · ${unit.name}`} />
          <Funnel totals={current} />
        </div>
        <div className="col" style={{ gap: 18 }}>
          <QuietHoursCoach share={current.quietShare} />
          <div className="card" style={{ ...card, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            <div className="col" style={{ gap: 2 }}>
              <span className="t-cap">במודל החזק ביותר</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: current.strongShare > 0.5 ? "var(--err)" : "var(--ink)" }}>{iPct(current.strongShare)}</span>
              <span className="t-cap">מהבקשות ב-Opus 4.1</span>
            </div>
          </div>
        </div>
      </div>

      <UsageOverTime series={report.series} window={report.window} metric={metric} setMetric={setMetric} title={`שימוש לאורך זמן · ${unit.name}`} />

      {report.children.length > 0 && (
        <div className="card" style={card}>
          <CardHead title={`השוואה בין ${unit.childLevelName ?? ""}`} sub="לחיצה על שורה צוללת פנימה" />
          <SortTable columns={childColumns} rows={report.children} sort={childSort} setSort={setChildSort} onRow={(r) => onNode(r.id)} />
        </div>
      )}

      <div style={grid("minmax(0, 1fr)")}>
        <ModelsCard byModel={report.byModel} totalCost={current.cost} />
      </div>

      <div style={grid("minmax(0, 1.35fr) minmax(0, 1fr)")}>
        <div className="card" style={card}>
          <CardHead title="מתי עובדים עם AI" sub="יום ושעה · כל ההיקף הנבחר" />
          <Heatmap cells={report.heatmap} fmt={iMoney} />
        </div>
        <TokenPie slices={slices} byChildren={byChildren} childLevel={unit.childLevelName} nodeName={unit.name} totalTokens={current.tokens} />
      </div>

      <div className="card" style={card}>
        <CardHead
          title={`כל המשתמשים · ${unit.name}`}
          sub="ממוינים מהשימוש הגבוה לנמוך · לחיצה על שורה צוללת לרמת המשתמש"
          right={
            <div className="row" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 6, border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "6px 10px", width: 200 }}>
                <Icon name="search" size={14} style={{ color: "var(--muted)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש שם…"
                  aria-label="חיפוש שם"
                  style={{ border: 0, outline: 0, background: "none", fontSize: 13, fontFamily: "inherit", width: "100%" }}
                />
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadUsersCsv(report)}>
                <Icon name="download" size={14} /> CSV
              </button>
            </div>
          }
        />
        <SortTable columns={userColumns} rows={users} sort={userSort} setSort={setUserSort} onRow={onUser} maxHeight={560} />
        <div className="t-cap" style={{ marginTop: 10 }}>
          {users.length} משתמשים
        </div>
      </div>
    </>
  );
}

function ScopeSkeleton() {
  return (
    <div className="col" style={{ gap: 18 }} aria-busy="true">
      <Skeleton height={32} style={{ borderRadius: 99, width: 320 }} />
      <div style={grid("repeat(auto-fit, minmax(200px, 1fr))", 14)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={128} />
        ))}
      </div>
      <Skeleton height={420} />
    </div>
  );
}

function downloadUsersCsv(report: NodeReport): void {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["שם", "תפקיד", "צוות", "מדור", "ימים פעילים", "בקשות", "טוקנים", "עלות $", "% שעות שקטות", "% Opus"];
  const rows = report.users.map((u) => [
    u.name,
    u.role,
    u.teamName,
    u.sectionName,
    u.activeDays,
    Math.round(u.requests),
    Math.round(u.tokens),
    u.cost.toFixed(2),
    u.requests ? Math.round((u.quietRequests / u.requests) * 100) : 0,
    Math.round(u.strongShare * 100),
  ]);
  const csv = `\uFEFF${[header, ...rows].map((r) => r.map(escape).join(",")).join("\n")}`;
  const link = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
    download: `ai-usage-${report.node.name}.csv`,
  });
  link.click();
}
