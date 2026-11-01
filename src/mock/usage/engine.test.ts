import { describe, expect, it } from "vitest";
import config from "../data/usage-config.json";
import doc from "../data/usage-dataset.json";
import { peakShare, quietShare, strongShare, UsageDataset, UsageEngine, type Aggregate, type DatasetDocument, type Filters, type RawUsageConfig } from "./engine";
import golden from "./golden.json";

/** The metrics must match the reference (design-file) implementation exactly, float for float. */
interface Scenario {
  name: string;
  ids: string[] | null;
  endIdx: number;
  range: number;
  sh: number;
  eh: number;
  filters: Filters;
  current: Record<string, unknown>;
  previous: Record<string, unknown>;
}

const engine = new UsageEngine(new UsageDataset(doc as unknown as DatasetDocument), config as unknown as RawUsageConfig);

const packed = (a: Aggregate): Record<string, unknown> => ({
  users: a.users,
  requests: a.requests,
  tokens: a.tokens,
  cost: a.cost,
  quietRequests: a.quietRequests,
  quietCost: a.quietCost,
  quietShare: quietShare(a),
  peakShare: peakShare(a),
  strongShare: strongShare(a),
  installed: a.installed,
  firstRequest: a.firstRequest,
  weeklyActive: a.weeklyActive,
  dailyActive: a.dailyActive,
  smart: a.smart,
  active: a.active,
  byModel: a.byModel.map((m) => [m.requests, m.tokens, m.cost]),
  series: [a.requestsSeries, a.tokensSeries, a.costSeries, a.quietRequestsSeries, a.quietTokensSeries, a.quietCostSeries].map((s) => Array.from(s)),
  hourly: engine.hourlyLoad(a),
  weekday: engine.weekdayLoad(a),
  rows: a.rows.map((s) => [
    s.member.id,
    s.requests,
    s.tokens,
    s.cost,
    s.quietRequests,
    s.activeDays,
    s.eligibleDays,
    s.workdayActive,
    s.workdayEligible,
    s.daily,
    s.strongShare,
    Array.from(s.dailyRequests),
  ]),
});

describe("usage engine parity", () => {
  it("uses the same dataset start", () => expect(engine.dataset.start).toBe(golden.start));

  for (const scenario of golden.scenarios as unknown as Scenario[]) {
    it(scenario.name, () => {
      const ids = scenario.ids ?? engine.dataset.memberIdsUnder(engine.dataset.rootId);
      const window = { end: scenario.endIdx, length: scenario.range, startHour: scenario.sh, endHour: scenario.eh };
      for (const [period, offset] of [["current", 0], ["previous", 1]] as const) {
        const actual = packed(engine.aggregate(ids, window, scenario.filters, offset));
        for (const [key, value] of Object.entries(scenario[period])) expect(actual[key], `${period}.${key}`).toEqual(value);
      }
    });
  }
});
