import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, type Query } from "@/shared/api/http";

export type HoursFilter = "all" | "work";
export type DaysFilter = "all" | "work";
export type Metric = "req" | "tok" | "cost";

export interface Period {
  range: 7 | 30 | 90 | null;
  from: string | null;
  to: string | null;
  hours: HoursFilter;
  days: DaysFilter;
}

export interface UsageWindow {
  start: string;
  end: string;
  startHour: number;
  endHour: number;
  days: number;
  dates: string[];
  weekdays: number[];
  isLatest: boolean;
}

export interface Totals {
  users: number;
  requests: number;
  tokens: number;
  cost: number;
  quietRequests: number;
  quietCost: number;
  quietShare: number;
  peakShare: number;
  strongShare: number;
  installed: number;
  firstRequest: number;
  weeklyActive: number;
  dailyActive: number;
  smart: number;
  active: number;
}

export interface Series {
  requests: number[];
  tokens: number[];
  cost: number[];
  quietRequests: number[];
  quietTokens: number[];
  quietCost: number[];
}

export interface ModelUsage {
  modelId: string;
  requests: number;
  tokens: number;
  cost: number;
}

export interface PersonalStats {
  activeDays: number;
  eligibleDays: number;
  workdayActive: number;
  workdayEligible: number;
  daily: boolean;
  strongShare: number;
}

export interface PersonalReport {
  window: UsageWindow;
  member: { id: string; name: string; role: string; teamId: string; unitPath: string[]; tools: string[]; isMe: boolean };
  current: Totals;
  previous: Totals;
  series: Series;
  byModel: ModelUsage[];
  load: { hourly: number[]; weekday: number[] };
  stats: PersonalStats;
  previousStats: PersonalStats;
  organization: { dailyActive: number; hourly: number[] };
}

export interface NodeRef {
  id: string;
  name: string;
  level: number;
  levelName: string;
}

export interface ChildRow {
  id: string;
  name: string;
  users: number;
  installed: number;
  dailyActive: number;
  active: number;
  cost: number;
  tokens: number;
  quietShare: number;
  costSeries: number[];
  previousCost: number;
}

export interface UserRow {
  id: string;
  name: string;
  role: string;
  teamId: string;
  teamName: string;
  sectionName: string;
  isMe: boolean;
  tools: string[];
  activeDays: number;
  eligibleDays: number;
  requests: number;
  tokens: number;
  cost: number;
  quietRequests: number;
  strongShare: number;
  dailyRequests: number[];
  previousCost: number;
}

export interface NodeReport {
  window: UsageWindow;
  node: NodeRef & { childLevelName: string | null; path: NodeRef[]; children: NodeRef[]; members: { id: string; name: string }[] };
  current: Totals;
  previous: Totals;
  series: Series;
  byModel: ModelUsage[];
  heatmap: number[][];
  children: ChildRow[];
  users: UserRow[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  tier: number;
  input: number;
  output: number;
  blended: number;
  enabled: boolean;
}

export interface UsageConfig {
  workDays: number[];
  workStart: number;
  workEnd: number;
  peaks: [number, number][];
  dailyPct: number;
  weeklyPct: number;
  smartQuiet: number;
  smartStrong: number;
  premiumWarn: number;
  defaultRange: number;
  models: ModelInfo[];
  tools: { id: string; name: string; icon: string; enabled: boolean }[];
  tiers: Record<string, { label: string; sign: string; hint: string }>;
  data: { first: string; last: string };
}

export interface Scope extends NodeRef {
  users: number;
}

const periodQuery = (p: Period): Query => ({ range: p.range, from: p.from, to: p.to, hours: p.hours, days: p.days });
const DAY_MS = 86_400_000;

export const usageKeys = {
  config: ["usage", "config"] as const,
  scopes: ["usage", "scopes"] as const,
  me: (p: Period) => ["usage", "me", p] as const,
  member: (id: string, p: Period) => ["usage", "member", id, p] as const,
  node: (id: string, p: Period) => ["usage", "node", id, p] as const,
};

export const useUsageConfig = () =>
  useQuery({ queryKey: usageKeys.config, queryFn: ({ signal }) => http.get<UsageConfig>("/usage/config", undefined, signal), staleTime: DAY_MS });

export const useScopes = (enabled: boolean) =>
  useQuery({
    queryKey: usageKeys.scopes,
    queryFn: ({ signal }) => http.get<{ scopes: Scope[] }>("/org/tree", undefined, signal),
    select: (data) => data.scopes,
    staleTime: DAY_MS,
    enabled,
  });

export const useMyUsage = (period: Period, enabled = true) =>
  useQuery({
    queryKey: usageKeys.me(period),
    queryFn: ({ signal }) => http.get<PersonalReport>("/usage/me", periodQuery(period), signal),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useMemberUsage = (id: string | null, period: Period) =>
  useQuery({
    queryKey: usageKeys.member(id ?? "", period),
    queryFn: ({ signal }) => http.get<PersonalReport>(`/usage/users/${encodeURIComponent(id ?? "")}`, periodQuery(period), signal),
    placeholderData: keepPreviousData,
    enabled: id !== null,
  });

export const useNodeUsage = (id: string | null, period: Period) =>
  useQuery({
    queryKey: usageKeys.node(id ?? "", period),
    queryFn: ({ signal }) => http.get<NodeReport>(`/usage/nodes/${encodeURIComponent(id ?? "")}`, periodQuery(period), signal),
    placeholderData: keepPreviousData,
    enabled: id !== null,
  });
