import { pad2 } from "./format";

const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (iso: string, days: number): string => toIso(new Date(parse(iso).getTime() + days * 86_400_000));

/** 0 = Sunday */
export const weekday = (iso: string): number => parse(iso).getUTCDay();

export const dayOfMonth = (iso: string): number => parse(iso).getUTCDate();

export const at = (iso: string, hour: number): string => `${iso.slice(0, 10)}T${pad2(hour)}:00`;

export interface DateTimeParts {
  y: number;
  m: number;
  d: number;
  h: number;
}

export function parseDateTime(value: string): DateTimeParts {
  const [date = "", time = "0"] = value.split("T");
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return { y, m: m - 1, d, h: parseInt(time, 10) || 0 };
}

export const formatDateTime = ({ y, m, d, h }: DateTimeParts): string => `${y}-${pad2(m + 1)}-${pad2(d)}T${pad2(h)}:00`;

/** Shortcut ranges relative to the last day with data. */
export function shortcuts(last: string): readonly (readonly [label: string, from: string, to: string])[] {
  const dow = weekday(last);
  return [
    ["השבוע", at(addDays(last, -dow), 0), at(last, 23)],
    ["שבוע שעבר", at(addDays(last, -7 - dow), 0), at(addDays(last, -1 - dow), 23)],
    ["החודש", at(addDays(last, 1 - dayOfMonth(last)), 0), at(last, 23)],
  ];
}
