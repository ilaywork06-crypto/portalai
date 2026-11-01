import { describe, expect, it } from "vitest";
import { fitToData, parseSaved } from "./useUsageView";

const data = { first: "2026-05-02", last: "2026-10-28" };

describe("parseSaved", () => {
  it("keeps a valid saved view", () => {
    const json = JSON.stringify({ range: 7, custom: { from: "2026-10-01T09:00", to: "2026-10-02T18:00" }, hours: "work", days: "all" });
    expect(parseSaved(json)).toEqual({ range: 7, custom: { from: "2026-10-01T09:00", to: "2026-10-02T18:00" }, hours: "work", days: "all" });
  });

  it.each(["not json", "null", "5", '"x"', JSON.stringify({ range: "14", custom: { from: 12, to: null }, hours: "evening", days: 3 })])("drops what it cannot use: %s", (json) => {
    expect(parseSaved(json)).toEqual({ range: null, custom: null, hours: null, days: null });
  });
});

describe("fitToData", () => {
  it("keeps a range inside the data", () => {
    expect(fitToData({ from: "2026-10-01T09:00", to: "2026-10-02T18:00" }, data)).toEqual({ from: "2026-10-01T09:00", to: "2026-10-02T18:00" });
  });

  it("clips a range that overlaps the data", () => {
    expect(fitToData({ from: "2026-04-01T09:00", to: "2026-11-30T09:00" }, data)).toEqual({ from: "2026-05-02T00:00", to: "2026-10-29T00:00" });
  });

  it.each([
    ["before", { from: "2025-01-01T09:00", to: "2025-02-01T09:00" }],
    ["after", { from: "2027-01-01T09:00", to: "2027-02-01T09:00" }],
  ])("drops a range entirely %s the data", (_, range) => {
    expect(fitToData(range, data)).toBeNull();
  });

  it("leaves a backwards range for the form to flag", () => {
    expect(fitToData({ from: "2026-10-20T09:00", to: "2026-10-10T09:00" }, data)).toEqual({ from: "2026-10-20T09:00", to: "2026-10-10T09:00" });
  });
});
