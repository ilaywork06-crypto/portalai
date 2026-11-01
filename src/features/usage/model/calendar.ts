import { pad2 } from "./format";

export const HE_DOW = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] as const;
export const HE_DOW_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;

export interface CalendarRules {
  workDays: number[];
  workStart: number;
  workEnd: number;
  peaks: [number, number][];
}

/** Work, peak and quiet hours as configured on the server (0 = Sunday). */
export function createCalendar(rules: CalendarRules) {
  const isWorkDay = (day: number) => rules.workDays.includes(day);
  const isQuiet = (day: number, hour: number) => !isWorkDay(day) || hour < rules.workStart || hour >= rules.workEnd;
  const isPeak = (day: number, hour: number) => !isQuiet(day, hour) && rules.peaks.some(([a, b]) => hour >= a && hour < b);
  const offDays = () => [0, 1, 2, 3, 4, 5, 6].filter((day) => !isWorkDay(day));
  return { isWorkDay, isQuiet, isPeak, offDays, rules };
}

export type Calendar = ReturnType<typeof createCalendar>;

export const hourLabel = (hour: number): string => `${pad2(hour % 24 === 0 && hour ? 24 : hour)}:00`;

export const spanLabel = (from: number, to: number): string => `${hourLabel(from)}–${hourLabel(to)}`;

export function daysLabel(days: readonly number[], full = false): string {
  const sorted = [...days].sort((a, b) => a - b);
  const names = full ? HE_DOW_FULL : HE_DOW;
  if (!sorted.length) return "—";
  const contiguous = sorted.every((d, i) => i === 0 || d === (sorted[i - 1] ?? -2) + 1);
  if (contiguous && sorted.length > 2) return `${names[sorted[0] ?? 0]}–${names[sorted.at(-1) ?? 0]}`;
  return sorted.map((d) => names[d]).join(full ? " ו" : ", ");
}
