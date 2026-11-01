import { describe, expect, it } from "vitest";
import { fileSize, relativeTime } from "./relativeTime";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("relativeTime", () => {
  it.each([
    [10, "ממש עכשיו"],
    [60, "לפני דקה"],
    [5 * 60, "לפני 5 דקות"],
    [3600, "לפני שעה"],
    [2 * 3600, "לפני שעתיים"],
    [22 * 3600 + 300, "לפני 22 שעות"],
    [86400 + 300, "אתמול"],
    [2 * 86400 + 300, "לפני יומיים"],
    [6 * 86400 + 300, "לפני 6 ימים"],
  ])("%i seconds ago → %s", (seconds, label) => {
    expect(relativeTime(ago(seconds), NOW)).toBe(label);
  });

  it("never shows the future", () => {
    expect(relativeTime(ago(-30), NOW)).toBe("ממש עכשיו");
  });
});

describe("fileSize", () => {
  it.each([
    [null, ""],
    [512, "512 B"],
    [2048, "2 KB"],
    [3 * 1048576, "3.0 MB"],
  ])("%s → %s", (bytes, label) => {
    expect(fileSize(bytes)).toBe(label);
  });
});
