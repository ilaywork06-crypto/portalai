import type { Metric, PersonalReport } from "../api";
import { iMoney, iPct, iShort, iTok } from "../model/format";
import { useUsageSettings } from "../settings";
import { card, grid, ModelsCard, MyHoursCard, OrgLoadCard, QuietHoursCoach, UsageOverTime } from "./cards";
import { Kpi } from "./charts";

interface MeViewProps {
  report: PersonalReport;
  workHoursOnly: boolean;
  metric: Metric;
  setMetric: (metric: Metric) => void;
  self?: boolean;
}

/** "My AI", and the same view for one user in the hierarchy I manage. */
export function MeView({ report, workHoursOnly, metric, setMetric, self = true }: MeViewProps) {
  const { config } = useUsageSettings();
  const { current, previous, stats } = report;
  if (!stats.activeDays && !report.member.tools.length) {
    return (
      <div className="card" style={{ ...card, textAlign: "center" }}>
        <p className="t-body">{self ? "עוד לא התחלת להשתמש בכלי קוד." : "אין עדיין שימוש בכלי קוד."}</p>
      </div>
    );
  }
  const quietShown = !workHoursOnly;
  return (
    <div className="col stagger" style={{ gap: 18 }}>
      <div style={grid("repeat(auto-fit, minmax(190px, 1fr))", 14)}>
        <Kpi label="בקשות" value={iShort(current.requests)} cur={current.requests} prev={previous.requests} icon="send" />
        <Kpi label="טוקנים" value={iTok(current.tokens)} cur={current.tokens} prev={previous.tokens} icon="type" />
        <Kpi label="בהשוואה לבחוץ" value={iMoney(current.cost)} cur={current.cost} prev={previous.cost} icon="wallet" sub="לפי מחירון הספקים" />
        <Kpi
          label="ימי שימוש"
          value={stats.activeDays}
          unit={`מתוך ${stats.eligibleDays}`}
          cur={stats.activeDays}
          prev={report.previousStats.activeDays}
          good="up"
          icon="clock"
          sub={`${iPct(stats.eligibleDays ? stats.activeDays / stats.eligibleDays : 0)} מהימים בתקופה`}
        />
        <Kpi
          label="בשעות שקטות"
          value={quietShown ? iPct(current.quietShare) : "—"}
          cur={quietShown ? current.quietShare : null}
          prev={previous.quietShare}
          good="up"
          icon="moon"
          accent="var(--c-800)"
          sub={quietShown ? "מהבקשות" : "לא מוצג בסינון שעות עבודה"}
        />
        <Kpi
          label="במודל החזק ביותר"
          value={iPct(stats.strongShare)}
          icon="boltCoin"
          accent={stats.strongShare > config.premiumWarn / 100 ? "var(--err)" : null}
          sub="מהבקשות ב-Opus 4.1 ($$$)"
        />
      </div>
      <UsageOverTime series={report.series} window={report.window} metric={metric} setMetric={setMetric} title={self ? "השימוש שלי לאורך זמן" : "שימוש לאורך זמן"} />
      <div style={grid("repeat(auto-fit, minmax(380px, 1fr))")}>
        <MyHoursCard hourly={report.load.hourly} weekday={report.load.weekday} self={self} />
        <OrgLoadCard
          orgHourly={report.organization.hourly}
          orgDaily={report.organization.dailyActive}
          peakShare={current.peakShare}
          hasUsage={current.requests > 0}
          self={self}
        />
      </div>
      <div style={grid("repeat(auto-fit, minmax(380px, 1fr))")}>
        <ModelsCard byModel={report.byModel} totalCost={current.cost} />
        <QuietHoursCoach share={current.quietShare} self={self} />
      </div>
    </div>
  );
}
