const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "ממש עכשיו", "לפני 22 שעות", "אתמול", "לפני יומיים"…; older than a week falls back to the date. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (seconds < MINUTE) return "ממש עכשיו";
  const minutes = Math.floor(seconds / MINUTE);
  if (seconds < HOUR) return minutes === 1 ? "לפני דקה" : `לפני ${minutes} דקות`;
  const hours = Math.floor(seconds / HOUR);
  if (seconds < DAY) return hours === 1 ? "לפני שעה" : hours === 2 ? "לפני שעתיים" : `לפני ${hours} שעות`;
  const days = Math.floor(seconds / DAY);
  if (days < 7) return days === 1 ? "אתמול" : days === 2 ? "לפני יומיים" : `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", { month: "short", day: "numeric" });
}

export function fileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
