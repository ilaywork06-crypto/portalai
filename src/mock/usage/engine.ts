/**
 * Usage metrics, ported from the original server engine. Per-day series are float32 (Float32Array)
 * so the numbers match the reference implementation bit for bit (see engine.test.ts).
 */

export const DAYS_PER_WEEK = 7;
const HOURS = 24;
const DAY_MS = 86_400_000;

// ── config ────────────────────────────────────────────────────────────────────

export interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  tier: number;
  in: number;
  out: number;
  enabled?: boolean;
}

export interface RawUsageConfig {
  workDays: number[];
  workStart: number;
  workEnd: number;
  peaks: [number, number][];
  dailyPct: number;
  weeklyPct: number;
  smartQuiet: number;
  smartStrong: number;
  premiumWarn: number;
  inputShare: number;
  showNames?: boolean;
  defaultRange?: number;
  retentionDays?: number;
  models: ModelPricing[];
  tools: { id: string; name: string; icon: string; enabled?: boolean }[];
  tiers: Record<string, { label: string; sign: string; hint: string }>;
}

/** $ per 1M tokens for the typical coding-tool mix of input and output. */
export function blendedRate(config: RawUsageConfig, model: ModelPricing): number {
  const mix = config.inputShare / 100;
  return mix * model.in + (1 - mix) * model.out;
}

const strongestModel = (config: RawUsageConfig): ModelPricing =>
  config.models.reduce((best, m) => (m.tier > best.tier ? m : best));

// ── dataset ───────────────────────────────────────────────────────────────────

export const LEVELS = ["ארגון", "יחידה", "מרכז", "ענף", "מדור", "צוות", "יוזר"];
export const LEVELS_PLURAL = ["ארגונים", "יחידות", "מרכזים", "ענפים", "מדורים", "צוותים", "משתמשים"];
const TEAM_LEVEL = 5;

export interface OrgNode {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  children: string[];
}

export interface Member {
  id: string;
  name: string;
  role: string;
  teamId: string;
  tools: string[];
  modelShare: Record<string, number>;
  tokensPerRequest: number;
  peakShare: number;
  firstDay: number;
}

export interface DatasetDocument {
  start: string;
  days: number;
  nodes: { id: string; name: string; level: number; parent: string | null }[];
  users: (Omit<Member, "teamId"> & { teamId: string; daily: [index: number, work: number, quiet: number][] })[];
}

export const levelName = (node: OrgNode) => LEVELS[node.level] ?? "";
export const childLevelPlural = (node: OrgNode) => (node.level < TEAM_LEVEL ? (LEVELS_PLURAL[node.level + 1] ?? null) : null);

export class UsageDataset {
  readonly start: string;
  readonly startMs: number;
  readonly days: number;
  readonly nodes = new Map<string, OrgNode>();
  readonly members: Member[];
  readonly usage = new Map<string, { work: number[]; quiet: number[] }>();
  readonly rootId: string;
  readonly dates: string[];
  readonly weekdays: number[];
  private readonly byId = new Map<string, Member>();
  private readonly under = new Map<string, string[]>();

  constructor(doc: DatasetDocument) {
    this.start = doc.start;
    this.startMs = Date.parse(`${doc.start}T00:00:00Z`);
    this.days = doc.days;
    for (const n of doc.nodes) this.nodes.set(n.id, { id: n.id, name: n.name, level: n.level, parentId: n.parent, children: [] });
    for (const n of doc.nodes) if (n.parent) this.nodes.get(n.parent)?.children.push(n.id);
    this.rootId = doc.nodes.find((n) => n.parent === null)?.id ?? "";
    this.members = doc.users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      teamId: u.teamId,
      tools: u.tools,
      modelShare: u.modelShare,
      tokensPerRequest: u.tokensPerRequest,
      peakShare: u.peakShare,
      firstDay: u.firstDay,
    }));
    for (const u of doc.users) {
      const work = new Array<number>(doc.days).fill(0);
      const quiet = new Array<number>(doc.days).fill(0);
      for (const [index, w, q] of u.daily) {
        work[index] = w;
        quiet[index] = q;
      }
      this.usage.set(u.id, { work, quiet });
    }
    this.dates = Array.from({ length: doc.days }, (_, i) => new Date(this.startMs + i * DAY_MS).toISOString().slice(0, 10));
    this.weekdays = Array.from({ length: doc.days }, (_, i) => new Date(this.startMs + i * DAY_MS).getUTCDay()); // 0 = Sunday
    for (const id of this.nodes.keys()) this.under.set(id, []);
    for (const m of this.members) {
      this.byId.set(m.id, m);
      for (const node of this.path(m.teamId)) this.under.get(node.id)?.push(m.id);
    }
  }

  get lastDay(): number {
    return this.days - 1;
  }

  member(id: string): Member | undefined {
    return this.byId.get(id);
  }

  memberIdsUnder(nodeId: string): string[] {
    return this.under.get(nodeId) ?? [];
  }

  path(nodeId: string): OrgNode[] {
    const path: OrgNode[] = [];
    let current: string | null = nodeId;
    while (current !== null) {
      const node = this.nodes.get(current);
      if (!node) break;
      path.unshift(node);
      current = node.parentId;
    }
    return path;
  }

  contains(ancestorId: string, nodeId: string): boolean {
    return this.nodes.has(nodeId) && this.path(nodeId).some((n) => n.id === ancestorId);
  }

  sectionOf(member: Member): OrgNode {
    const team = this.nodes.get(member.teamId);
    if (!team) throw new Error(`Unknown team ${member.teamId}`);
    return (team.parentId ? this.nodes.get(team.parentId) : undefined) ?? team;
  }
}

// ── window ────────────────────────────────────────────────────────────────────

export type HoursFilter = "all" | "work";
export type DaysFilter = "all" | "work";

export interface Filters {
  hours: HoursFilter;
  days: DaysFilter;
}

/** `length` days ending on day index `end`; the first and last day may be cut to [startHour, endHour). */
export interface Window {
  end: number;
  length: number;
  startHour: number;
  endHour: number;
}

export const bounds = (w: Window, offset = 0): [number, number] => {
  const end = w.end - offset * w.length;
  return [end - w.length + 1, end];
};

export class UsageError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const PRESET_RANGES = [7, 30, 90];

export function presetWindow(dataset: UsageDataset, days: number): Window {
  if (!PRESET_RANGES.includes(days)) throw new UsageError(422, "invalid_range", `Range must be one of ${PRESET_RANGES.join(", ")} days.`);
  return { end: dataset.lastDay, length: days, startHour: 0, endHour: 24 };
}

/** Parses a naive ISO date-time ("2026-10-01T09:00") as wall-clock hours (UTC ms, minutes dropped). */
function parseHour(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}))?/.exec(value);
  if (!m) throw new UsageError(422, "invalid_input", "Invalid date.");
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0));
}

/** Whole wall-clock hours, clipped to the days that have data (a saved or shared range may predate them). */
export function customWindow(dataset: UsageDataset, from: string, to: string): Window {
  let start = parseHour(from);
  let end = parseHour(to);
  if (end <= start) throw new UsageError(422, "invalid_range", "The end date must be after the start date.");
  start = Math.max(start, dataset.startMs);
  end = Math.min(end, dataset.startMs + dataset.days * DAY_MS);
  if (end <= start) throw new UsageError(422, "range_outside_data", "There is no usage data in the selected range.");
  const first = Math.floor((start - dataset.startMs) / DAY_MS);
  const last = Math.floor((end - dataset.startMs) / DAY_MS);
  const endHour = new Date(end).getUTCHours();
  const endDay = endHour === 0 ? last - 1 : last;
  return { end: endDay, length: endDay - first + 1, startHour: new Date(start).getUTCHours(), endHour: endHour || 24 };
}

// ── calendar ──────────────────────────────────────────────────────────────────

/** Work, peak and quiet hours derived from the config, plus the typical hour-of-week load shape. */
export class WorkCalendar {
  readonly workNorm: number;
  readonly quietNorm: number;

  constructor(private readonly config: RawUsageConfig) {
    this.workNorm = weekSum((d, h) => this.workWeight(d, h));
    this.quietNorm = weekSum((d, h) => this.quietWeight(d, h));
  }

  isWorkDay(weekday: number): boolean {
    return this.config.workDays.includes(weekday);
  }

  isQuiet(weekday: number, hour: number): boolean {
    return !this.isWorkDay(weekday) || hour < this.config.workStart || hour >= this.config.workEnd;
  }

  isPeak(weekday: number, hour: number): boolean {
    return !this.isQuiet(weekday, hour) && this.config.peaks.some(([a, b]) => a <= hour && hour < b);
  }

  workWeight(weekday: number, hour: number): number {
    if (this.isQuiet(weekday, hour)) return 0;
    let base: number;
    if (this.isPeak(weekday, hour)) base = 1.0;
    else if ((hour >= 10 && hour < 12) || (hour >= 14 && hour < 16)) base = 0.7;
    else base = 0.48;
    return base * (weekday === 4 ? 0.85 : 1);
  }

  quietWeight(weekday: number, hour: number): number {
    if (!this.isQuiet(weekday, hour)) return 0;
    if (!this.isWorkDay(weekday)) return hour >= 10 && hour <= 23 ? 0.35 : hour < 2 ? 0.25 : 0.04;
    if (hour >= 21) return 0.8 - (hour - 21) * 0.18;
    return hour < 2 ? 0.3 : hour < 7 ? 0.06 : 0.2;
  }

  /** Share of a day's work (or quiet) requests that falls in [start, end). */
  hourFraction(weekday: number, start: number, end: number, quiet: boolean): number {
    let inside = 0;
    let total = 0;
    for (let hour = 0; hour < HOURS; hour++) {
      const value = quiet ? this.quietWeight(weekday, hour) : this.workWeight(weekday, hour);
      total += value;
      if (start <= hour && hour < end) inside += value;
    }
    return total ? inside / total : 0;
  }

  cell(work: number, quiet: number, weekday: number, hour: number): number {
    return (work * this.workWeight(weekday, hour)) / this.workNorm + (quiet * this.quietWeight(weekday, hour)) / this.quietNorm;
  }
}

function weekSum(weight: (day: number, hour: number) => number): number {
  let total = 0;
  for (let day = 0; day < DAYS_PER_WEEK; day++) for (let hour = 0; hour < HOURS; hour++) total += weight(day, hour);
  return total;
}

// ── metrics ───────────────────────────────────────────────────────────────────

export interface MemberStats {
  member: Member;
  requests: number;
  tokens: number;
  cost: number;
  quietRequests: number;
  quietCost: number;
  peakRequests: number;
  activeDays: number;
  eligibleDays: number;
  workdayActive: number;
  workdayEligible: number;
  weekly: boolean;
  daily: boolean;
  smart: boolean;
  strongShare: number;
  dailyRequests: Float32Array;
  dailyQuiet: Float32Array;
}

export interface ModelUsage {
  modelId: string;
  requests: number;
  tokens: number;
  cost: number;
}

export interface Aggregate {
  users: number;
  requests: number;
  tokens: number;
  cost: number;
  quietRequests: number;
  quietCost: number;
  installed: number;
  firstRequest: number;
  weeklyActive: number;
  dailyActive: number;
  smart: number;
  active: number;
  strongRequests: number;
  peakRequests: number;
  byModel: ModelUsage[];
  requestsSeries: Float32Array;
  tokensSeries: Float32Array;
  costSeries: Float32Array;
  quietRequestsSeries: Float32Array;
  quietTokensSeries: Float32Array;
  quietCostSeries: Float32Array;
  rows: MemberStats[];
}

const share = (part: number, whole: number) => (whole ? part / whole : 0);
export const quietShare = (a: Aggregate) => share(a.quietRequests, a.requests);
export const peakShare = (a: Aggregate) => share(a.peakRequests, a.requests);
export const strongShare = (a: Aggregate) => share(a.strongRequests, a.requests);

/** Computes stats for one dataset and config. Member stats are memoized per window, filter and period. */
export class UsageEngine {
  readonly calendar: WorkCalendar;
  private readonly costPerRequest = new Map<string, number>();
  private readonly memo = new Map<string, MemberStats>();

  constructor(
    readonly dataset: UsageDataset,
    readonly config: RawUsageConfig,
  ) {
    this.calendar = new WorkCalendar(config);
    for (const m of dataset.members) this.costPerRequest.set(m.id, this.costRate(m));
  }

  private costRate(member: Member): number {
    let blended = 0;
    for (const model of this.config.models) blended = blended + (member.modelShare[model.id] ?? 0) * blendedRate(this.config, model);
    return (member.tokensPerRequest / 1e6) * blended;
  }

  memberStats(member: Member, window: Window, filters: Filters, offset = 0): MemberStats {
    const key = [member.id, window.end, window.length, window.startHour, window.endHour, filters.hours, filters.days, offset].join("|");
    let stats = this.memo.get(key);
    if (!stats) {
      stats = this.compute(member, window, filters, offset);
      this.memo.set(key, stats);
    }
    return stats;
  }

  private compute(member: Member, window: Window, filters: Filters, offset: number): MemberStats {
    const cal = this.calendar;
    const weekdays = this.dataset.weekdays;
    const usage = this.dataset.usage.get(member.id);
    const [start, end] = bounds(window, offset);
    const length = window.length;
    const weeks = new Array<boolean>(Math.ceil(length / DAYS_PER_WEEK)).fill(false);
    const dailyRequests = new Float32Array(length);
    const dailyQuiet = new Float32Array(length);
    let requests = 0;
    let quiet = 0;
    let allRequests = 0;
    let allQuiet = 0;
    let active = 0;
    let eligible = 0;
    let workdayEligible = 0;
    let workdayActive = 0;
    const workHoursOnly = filters.hours === "work";

    for (let day = Math.max(0, start); day <= end; day++) {
      const weekday = (weekdays[day] ?? 0);
      const fromHour = day === start ? window.startHour : 0;
      const toHour = day === end ? window.endHour : 24;
      const partial = fromHour > 0 || toHour < 24;
      const workDay = usage?.work[day] ?? 0;
      const quietDay = usage?.quiet[day] ?? 0;
      const work = workDay * (partial ? cal.hourFraction(weekday, fromHour, toHour, false) : 1);
      const quietPart = quietDay * (partial ? cal.hourFraction(weekday, fromHour, toHour, true) : 1);
      const total = work + quietPart;
      allRequests += total;
      allQuiet += quietPart;
      const counted = workHoursOnly ? work : total;
      const countedQuiet = workHoursOnly ? 0 : quietPart;
      if (cal.isWorkDay(weekday)) {
        workdayEligible += 1;
        if (counted > 0) workdayActive += 1;
      }
      if (filters.days === "work" && !cal.isWorkDay(weekday)) continue;
      eligible += 1;
      if (counted > 0) {
        active += 1;
        weeks[Math.floor((day - start) / DAYS_PER_WEEK)] = true;
      }
      requests += counted;
      quiet += countedQuiet;
      dailyRequests[day - start] = counted;
      dailyQuiet[day - start] = countedQuiet;
    }

    const cfg = this.config;
    const strong = member.modelShare[strongestModel(cfg).id] ?? 0;
    const rate = this.costPerRequest.get(member.id) ?? 0;
    const quietAll = allRequests ? allQuiet / allRequests : 0;
    const weekly = active > 0 && weeks.filter(Boolean).length / weeks.length >= cfg.weeklyPct / 100;
    const daily = workdayEligible > 0 && workdayActive >= (cfg.dailyPct / 100) * workdayEligible;
    return {
      member,
      requests,
      tokens: requests * member.tokensPerRequest,
      cost: requests * rate,
      quietRequests: quiet,
      quietCost: quiet * rate,
      peakRequests: (requests - quiet) * member.peakShare,
      activeDays: active,
      eligibleDays: eligible,
      workdayActive,
      workdayEligible,
      weekly,
      daily,
      smart: daily && quietAll >= cfg.smartQuiet / 100 && strong <= cfg.smartStrong / 100,
      strongShare: strong,
      dailyRequests,
      dailyQuiet,
    };
  }

  aggregate(memberIds: readonly string[], window: Window, filters: Filters, offset = 0): Aggregate {
    const cfg = this.config;
    const length = window.length;
    const [, end] = bounds(window, offset);
    const r: Aggregate = {
      users: memberIds.length,
      requests: 0,
      tokens: 0,
      cost: 0,
      quietRequests: 0,
      quietCost: 0,
      installed: 0,
      firstRequest: 0,
      weeklyActive: 0,
      dailyActive: 0,
      smart: 0,
      active: 0,
      strongRequests: 0,
      peakRequests: 0,
      byModel: [],
      requestsSeries: new Float32Array(length),
      tokensSeries: new Float32Array(length),
      costSeries: new Float32Array(length),
      quietRequestsSeries: new Float32Array(length),
      quietTokensSeries: new Float32Array(length),
      quietCostSeries: new Float32Array(length),
      rows: [],
    };
    const modelRequests = cfg.models.map(() => 0);
    const modelTokens = cfg.models.map(() => 0);
    const modelCost = cfg.models.map(() => 0);

    for (const memberId of memberIds) {
      const member = this.dataset.member(memberId);
      if (!member) continue;
      const s = this.memberStats(member, window, filters, offset);
      const rate = this.costPerRequest.get(member.id) ?? 0;
      const tpr = member.tokensPerRequest;
      r.rows.push(s);
      r.requests += s.requests;
      r.tokens += s.tokens;
      r.cost += s.cost;
      r.quietRequests += s.quietRequests;
      r.quietCost += s.quietCost;
      r.installed += member.tools.length ? 1 : 0;
      r.firstRequest += member.firstDay >= 0 && member.firstDay <= end ? 1 : 0;
      r.weeklyActive += s.weekly ? 1 : 0;
      r.dailyActive += s.daily ? 1 : 0;
      r.smart += s.smart ? 1 : 0;
      r.active += s.activeDays ? 1 : 0;
      r.strongRequests += s.requests * s.strongShare;
      r.peakRequests += s.peakRequests;
      cfg.models.forEach((model, i) => {
        const part = member.modelShare[model.id] ?? 0;
        const tokens = s.tokens * part;
        modelTokens[i] = (modelTokens[i] ?? 0) + tokens;
        modelRequests[i] = (modelRequests[i] ?? 0) + s.requests * part;
        modelCost[i] = (modelCost[i] ?? 0) + (tokens / 1e6) * blendedRate(cfg, model);
      });
      for (let i = 0; i < length; i++) {
        const req = (s.dailyRequests[i] ?? 0);
        if (!req) continue;
        const q = (s.dailyQuiet[i] ?? 0);
        r.requestsSeries[i] = (r.requestsSeries[i] ?? 0) + req;
        r.tokensSeries[i] = (r.tokensSeries[i] ?? 0) + req * tpr;
        r.costSeries[i] = (r.costSeries[i] ?? 0) + req * rate;
        r.quietRequestsSeries[i] = (r.quietRequestsSeries[i] ?? 0) + q;
        r.quietTokensSeries[i] = (r.quietTokensSeries[i] ?? 0) + q * tpr;
        r.quietCostSeries[i] = (r.quietCostSeries[i] ?? 0) + q * rate;
      }
    }

    let modelTotal = 0;
    for (const cost of modelCost) modelTotal += cost;
    const scale = r.cost / (modelTotal || 1);
    r.byModel = cfg.models.map((model, i) => ({
      modelId: model.id,
      requests: (modelRequests[i] ?? 0),
      tokens: (modelTokens[i] ?? 0),
      cost: (modelCost[i] ?? 0) * scale,
    }));
    return r;
  }

  hourlyLoad(a: Aggregate): number[] {
    const work = a.requests - a.quietRequests;
    const quiet = a.quietRequests;
    return Array.from({ length: HOURS }, (_, hour) => {
      let value = 0;
      for (let day = 0; day < DAYS_PER_WEEK; day++) value += this.calendar.cell(work, quiet, day, hour);
      return value;
    });
  }

  weekdayLoad(a: Aggregate): number[] {
    const work = a.requests - a.quietRequests;
    const quiet = a.quietRequests;
    return Array.from({ length: DAYS_PER_WEEK }, (_, day) => {
      let value = 0;
      for (let hour = 0; hour < HOURS; hour++) value += this.calendar.cell(work, quiet, day, hour);
      return value;
    });
  }

  costHeatmap(a: Aggregate): number[][] {
    const work = a.cost - a.quietCost;
    const quiet = a.quietCost;
    return Array.from({ length: DAYS_PER_WEEK }, (_, day) => Array.from({ length: HOURS }, (_, hour) => this.calendar.cell(work, quiet, day, hour)));
  }
}
