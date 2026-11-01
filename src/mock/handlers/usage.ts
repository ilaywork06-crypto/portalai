import rawConfig from "../data/usage-config.json";
import { forbidden, MockError, notFound, type Viewer } from "../core";
import { route } from "../router";
import {
  blendedRate,
  bounds,
  childLevelPlural,
  customWindow,
  levelName,
  peakShare,
  presetWindow,
  quietShare,
  strongShare,
  UsageDataset,
  UsageEngine,
  UsageError,
  type Aggregate,
  type DatasetDocument,
  type DaysFilter,
  type Filters,
  type HoursFilter,
  type Member,
  type MemberStats,
  type OrgNode,
  type RawUsageConfig,
  type Window,
} from "../usage/engine";

const config = rawConfig as unknown as RawUsageConfig;

// The demo dataset is ~1 MB: load it on the first Usage request, not with the app.
let engine: Promise<UsageEngine> | null = null;
const getEngine = () =>
  (engine ??= import("../data/usage-dataset.json").then((m) => new UsageEngine(new UsageDataset(m.default as unknown as DatasetDocument), config)));

interface Period {
  window: (dataset: UsageDataset) => Window;
  filters: Filters;
}

function period(query: URLSearchParams): Period {
  const from = query.get("from");
  const to = query.get("to");
  const range = Number(query.get("range")) || 30;
  const oneOf = (value: string | null): HoursFilter & DaysFilter => (value === "work" ? "work" : "all");
  return {
    window: (dataset) => (from && to ? customWindow(dataset, from, to) : presetWindow(dataset, range)),
    filters: { hours: oneOf(query.get("hours")), days: oneOf(query.get("days")) },
  };
}

/** Engine errors become API errors. */
async function withEngine<T>(run: (engine: UsageEngine) => T): Promise<T> {
  const e = await getEngine();
  try {
    return run(e);
  } catch (error) {
    if (error instanceof UsageError) throw new MockError(error.status, error.code, error.message);
    throw error;
  }
}

function scopeRoot(viewer: Viewer, dataset: UsageDataset, nodeId: string): string {
  const root = viewer.managedNodeIds.find((id) => dataset.contains(id, nodeId));
  if (!root) throw forbidden("This unit is outside the hierarchy you manage.");
  return root;
}

const displayName = (member: Member, viewer: Viewer) =>
  config.showNames !== false || member.id === viewer.userId ? member.name : `משתמש ${member.id.replace(/^u/, "").padStart(3, "0")}`;

const ref = (node: OrgNode) => ({ id: node.id, name: node.name, level: node.level, levelName: levelName(node) });

function windowOut(dataset: UsageDataset, window: Window) {
  const [first, last] = bounds(window);
  const days = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return {
    start: dataset.dates[first],
    end: dataset.dates[last],
    startHour: window.startHour,
    endHour: window.endHour,
    days: window.length,
    dates: days.map((d) => dataset.dates[d]),
    weekdays: days.map((d) => dataset.weekdays[d]),
    isLatest: last === dataset.lastDay,
  };
}

const totals = (a: Aggregate) => ({
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
});

const series = (a: Aggregate) => ({
  requests: Array.from(a.requestsSeries),
  tokens: Array.from(a.tokensSeries),
  cost: Array.from(a.costSeries),
  quietRequests: Array.from(a.quietRequestsSeries),
  quietTokens: Array.from(a.quietTokensSeries),
  quietCost: Array.from(a.quietCostSeries),
});

const stats = (s: MemberStats) => ({
  activeDays: s.activeDays,
  eligibleDays: s.eligibleDays,
  workdayActive: s.workdayActive,
  workdayEligible: s.workdayEligible,
  daily: s.daily,
  strongShare: s.strongShare,
});

function only(a: Aggregate): MemberStats {
  const [row] = a.rows;
  if (!row) throw notFound("The user does not exist.");
  return row;
}

function node(dataset: UsageDataset, id: string): OrgNode {
  const found = dataset.nodes.get(id);
  if (!found) throw notFound("The unit does not exist.");
  return found;
}

function personalReport(e: UsageEngine, member: Member, p: Period, viewer: Viewer) {
  const dataset = e.dataset;
  const window = p.window(dataset);
  const current = e.aggregate([member.id], window, p.filters);
  const previous = e.aggregate([member.id], window, p.filters, 1);
  const organization = e.aggregate(dataset.memberIdsUnder(dataset.rootId), window, p.filters);
  return {
    window: windowOut(dataset, window),
    member: {
      id: member.id,
      name: displayName(member, viewer),
      role: member.role,
      teamId: member.teamId,
      unitPath: dataset
        .path(member.teamId)
        .slice(1)
        .map((n) => n.name),
      tools: member.tools,
      isMe: member.id === viewer.userId,
    },
    current: totals(current),
    previous: totals(previous),
    series: series(current),
    byModel: current.byModel,
    load: { hourly: e.hourlyLoad(current), weekday: e.weekdayLoad(current) },
    stats: stats(only(current)),
    previousStats: stats(only(previous)),
    organization: { dailyActive: organization.dailyActive, hourly: e.hourlyLoad(organization) },
  };
}

function nodeReport(e: UsageEngine, nodeId: string, p: Period, viewer: Viewer) {
  const dataset = e.dataset;
  const target = node(dataset, nodeId);
  const rootId = scopeRoot(viewer, dataset, nodeId);
  const window = p.window(dataset);
  const memberIds = dataset.memberIdsUnder(nodeId);
  const fullPath = dataset.path(nodeId);
  const current = e.aggregate(memberIds, window, p.filters);
  const previous = e.aggregate(memberIds, window, p.filters, 1);
  const members = memberIds.map((id) => dataset.member(id)).filter((m): m is Member => m !== undefined);
  return {
    window: windowOut(dataset, window),
    node: {
      ...ref(target),
      childLevelName: childLevelPlural(target),
      path: fullPath.slice(fullPath.findIndex((n) => n.id === rootId)).map(ref),
      children: target.children.map((id) => ref(node(dataset, id))),
      members: members.map((m) => ({ id: m.id, name: displayName(m, viewer) })),
    },
    current: totals(current),
    previous: totals(previous),
    series: series(current),
    byModel: current.byModel,
    heatmap: e.costHeatmap(current),
    children: target.children.map((childId) => {
      const child = node(dataset, childId);
      const under = dataset.memberIdsUnder(childId);
      const now = e.aggregate(under, window, p.filters);
      const before = e.aggregate(under, window, p.filters, 1);
      return {
        id: child.id,
        name: child.name,
        users: now.users,
        installed: now.installed,
        dailyActive: now.dailyActive,
        active: now.active,
        cost: now.cost,
        tokens: now.tokens,
        quietShare: quietShare(now),
        costSeries: Array.from(now.costSeries),
        previousCost: before.cost,
      };
    }),
    users: current.rows.map((s, i) => {
      const m = s.member;
      return {
        id: m.id,
        name: displayName(m, viewer),
        role: m.role,
        teamId: m.teamId,
        teamName: dataset.nodes.get(m.teamId)?.name ?? "",
        sectionName: dataset.sectionOf(m).name,
        isMe: m.id === viewer.userId,
        tools: m.tools,
        activeDays: s.activeDays,
        eligibleDays: s.eligibleDays,
        requests: s.requests,
        tokens: s.tokens,
        cost: s.cost,
        quietRequests: s.quietRequests,
        strongShare: s.strongShare,
        dailyRequests: Array.from(s.dailyRequests),
        previousCost: previous.rows[i]?.cost ?? 0,
      };
    }),
  };
}

export const usageRoutes = [
  route("GET", "/usage/config", () =>
    withEngine((e) => ({
      workDays: config.workDays,
      workStart: config.workStart,
      workEnd: config.workEnd,
      peaks: config.peaks,
      dailyPct: config.dailyPct,
      weeklyPct: config.weeklyPct,
      smartQuiet: config.smartQuiet,
      smartStrong: config.smartStrong,
      premiumWarn: config.premiumWarn,
      defaultRange: config.defaultRange ?? 30,
      models: config.models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        tier: m.tier,
        input: m.in,
        output: m.out,
        blended: blendedRate(config, m),
        enabled: m.enabled ?? true,
      })),
      tools: config.tools.map((t) => ({ ...t, enabled: t.enabled ?? true })),
      tiers: config.tiers,
      data: { first: e.dataset.dates[0], last: e.dataset.dates[e.dataset.lastDay] },
    })),
  ),

  route("GET", "/org/tree", ({ viewer }) =>
    withEngine((e) => ({
      scopes: viewer.managedNodeIds.flatMap((id) => {
        const node = e.dataset.nodes.get(id);
        return node ? [{ ...ref(node), users: e.dataset.memberIdsUnder(id).length }] : [];
      }),
    })),
  ),

  route("GET", "/usage/me", ({ viewer, query }) =>
    withEngine((e) => {
      const member = e.dataset.member(viewer.userId);
      if (!member) throw new MockError(404, "no_usage", "No coding-tool usage was recorded for you yet.");
      return personalReport(e, member, period(query), viewer);
    }),
  ),

  route("GET", "/usage/users/:id", ({ viewer, params, query }) =>
    withEngine((e) => {
      const member = e.dataset.member(params.id ?? "");
      if (!member) throw notFound("The user does not exist.");
      scopeRoot(viewer, e.dataset, member.teamId);
      return personalReport(e, member, period(query), viewer);
    }),
  ),

  route("GET", "/usage/nodes/:id", ({ viewer, params, query }) => withEngine((e) => nodeReport(e, params.id ?? "", period(query), viewer))),
];
