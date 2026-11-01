import { describe, expect, it } from "vitest";
import { createCalendar, daysLabel, spanLabel } from "./calendar";
import { addDays, parseDateTime, shortcuts, weekday } from "./dates";
import { dayLabel, iMoney, iPct, iShort, iTok } from "./format";

describe("format", () => {
  it.each([
    [3.456, "$3.46"],
    [42.4, "$42"],
    [1234.5, "$1,235"],
    [12345, "$12.3K"],
    [123456, "$123K"],
  ])("money %s → %s", (value, label) => expect(iMoney(value)).toBe(label));

  it("shortens tokens and requests", () => {
    expect(iTok(950)).toBe("950");
    expect(iTok(48_200)).toBe("48K");
    expect(iTok(12_340_000)).toBe("12.3M");
    expect(iTok(2_500_000_000)).toBe("2.50B");
    expect(iShort(9_999)).toBe("9,999");
    expect(iShort(12_600)).toBe("13K");
  });

  it("formats percentages and day labels", () => {
    expect(iPct(0.256)).toBe("26%");
    expect(dayLabel("2026-10-05")).toBe("5.10");
  });
});

describe("calendar", () => {
  const calendar = createCalendar({ workDays: [0, 1, 2, 3, 4], workStart: 9, workEnd: 21, peaks: [[12, 14], [16, 18]] });

  it("derives quiet and peak hours from the config", () => {
    expect(calendar.isQuiet(0, 8)).toBe(true);
    expect(calendar.isQuiet(0, 9)).toBe(false);
    expect(calendar.isQuiet(5, 12)).toBe(true);
    expect(calendar.isPeak(1, 13)).toBe(true);
    expect(calendar.isPeak(5, 13)).toBe(false);
    expect(calendar.offDays()).toEqual([5, 6]);
  });

  it("labels days and spans", () => {
    expect(daysLabel([0, 1, 2, 3, 4], true)).toBe("ראשון–חמישי");
    expect(daysLabel([5, 6], true)).toBe("שישי ושבת");
    expect(daysLabel([5, 6])).toBe("ו׳, ש׳");
    expect(spanLabel(9, 21)).toBe("09:00–21:00");
    expect(spanLabel(0, 24)).toBe("00:00–24:00");
  });
});

describe("dates", () => {
  it("does calendar math on ISO days", () => {
    expect(addDays("2026-10-28", -13)).toBe("2026-10-15");
    expect(weekday("2026-10-28")).toBe(3);
    expect(parseDateTime("2026-10-15T09:00")).toEqual({ y: 2026, m: 9, d: 15, h: 9 });
  });

  it("builds shortcut ranges from the last day with data", () => {
    expect(shortcuts("2026-10-28")).toEqual([
      ["השבוע", "2026-10-25T00:00", "2026-10-28T23:00"],
      ["שבוע שעבר", "2026-10-18T00:00", "2026-10-24T23:00"],
      ["החודש", "2026-10-01T00:00", "2026-10-28T23:00"],
    ]);
  });
});
