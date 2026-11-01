import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { DaysFilter, HoursFilter, Period } from "./api";
import { addDays, at } from "./model/dates";

export type Tab = "me" | "under";
export type RangeChoice = 7 | 30 | 90 | "custom";
export interface CustomRange {
  from: string;
  to: string;
}

const STORAGE_KEY = "portal.insights.view";
const ISO_HOUR = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/;
const FALLBACK_RANGE = 30;
const FILTERS = ["all", "work"] as const;

interface Saved {
  range: RangeChoice | null;
  custom: CustomRange | null;
  hours: HoursFilter | null;
  days: DaysFilter | null;
}

const parseRange = (value: unknown): RangeChoice | null => {
  if (value === "custom") return "custom";
  const n = Number(value);
  return n === 7 || n === 30 || n === 90 ? n : null;
};
const oneOf = <T extends string>(value: unknown, options: readonly T[]): T | null => (options.includes(value as T) ? (value as T) : null);
const parseCustom = (from: unknown, to: unknown): CustomRange | null =>
  typeof from === "string" && typeof to === "string" && ISO_HOUR.test(from) && ISO_HOUR.test(to) ? { from, to } : null;

const asRecord = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

/** Written by an earlier version or edited by hand: every field is checked like a URL param. */
export function parseSaved(json: string | null): Saved {
  try {
    const saved = asRecord(JSON.parse(json ?? "{}"));
    const custom = asRecord(saved.custom);
    return { range: parseRange(saved.range), custom: parseCustom(custom.from, custom.to), hours: oneOf(saved.hours, FILTERS), days: oneOf(saved.days, FILTERS) };
  } catch {
    return parseSaved(null);
  }
}

function loadSaved(): Saved {
  try {
    return parseSaved(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseSaved(null);
  }
}

/** A remembered or shared range may lie outside the days that have data now: clip it, or drop it if nothing is left. */
export function fitToData(range: CustomRange | null, data: { first: string; last: string }): CustomRange | null {
  if (!range) return null;
  const lo = at(data.first, 0);
  const hi = at(addDays(data.last, 1), 0);
  if (range.to <= lo || range.from >= hi) return null;
  return { from: range.from < lo ? lo : range.from, to: range.to > hi ? hi : range.to };
}

/** Usage filter state, kept in the URL (shareable) and in localStorage (remembered between visits). */
export function useUsageView({
  canManage,
  scopeRoot,
  data,
  defaultCustom,
}: {
  canManage: boolean;
  scopeRoot: string | null;
  data: { first: string; last: string };
  defaultCustom: CustomRange;
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const saved = useMemo(loadSaved, []);

  const [tab, setTabState] = useState<Tab>(() => (params.get("tab") === "under" && canManage ? "under" : "me"));
  const [range, setRange] = useState<RangeChoice>(() => parseRange(params.get("range")) ?? parseRange(saved.range) ?? FALLBACK_RANGE);
  const [custom, setCustom] = useState<CustomRange>(
    () => fitToData(parseCustom(params.get("from"), params.get("to")), data) ?? fitToData(saved.custom, data) ?? defaultCustom,
  );
  const [hours, setHours] = useState<HoursFilter>(() => oneOf(params.get("hours"), ["all", "work"]) ?? saved.hours ?? "all");
  const [days, setDays] = useState<DaysFilter>(() => oneOf(params.get("days"), ["all", "work"]) ?? saved.days ?? "all");
  const [nodeId, setNodeId] = useState<string | null>(() => params.get("node"));
  const [userId, setUserId] = useState<string | null>(() => params.get("user"));

  const customInvalid = range === "custom" && custom.to <= custom.from;
  const period: Period = useMemo(
    () =>
      range === "custom" && !customInvalid
        ? { range: null, from: custom.from, to: custom.to, hours, days }
        : { range: range === "custom" ? FALLBACK_RANGE : range, from: null, to: null, hours, days },
    [range, customInvalid, custom.from, custom.to, hours, days],
  );

  useEffect(() => {
    const next: Record<string, string> = { tab, range: String(range) };
    if (range === "custom") Object.assign(next, custom);
    Object.assign(next, { hours, days });
    if (tab === "under") {
      if (nodeId && nodeId !== scopeRoot) next.node = nodeId;
      if (userId) next.user = userId;
    }
    const search = new URLSearchParams(next).toString();
    if (search !== params.toString()) setParams(next, { replace: true });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ range, custom, hours, days }));
    } catch {
      // Storage can be unavailable (private mode); the URL still holds the view.
    }
    // `location.search` restores the params after a nav click on the current page.
  }, [tab, range, custom, hours, days, nodeId, userId, scopeRoot, location.search, params, setParams]);

  return {
    tab,
    setTab: (next: Tab) => {
      setTabState(next);
      setNodeId(null);
      setUserId(null);
    },
    range,
    setRange,
    custom,
    setCustom,
    customInvalid,
    hours,
    setHours,
    days,
    setDays,
    period,
    nodeId: nodeId ?? scopeRoot,
    userId,
    goNode: (id: string) => {
      setUserId(null);
      setNodeId(id);
    },
    openUser: (id: string, teamId: string) => {
      setNodeId(teamId);
      setUserId(id);
    },
    resetScope: () => {
      setNodeId(null);
      setUserId(null);
    },
  };
}
