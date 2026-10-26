import { describe, expect, it } from "vitest";
import {
  dayKeyInZone,
  formatDayInZone,
  formatTimeInZone,
  parseServerInstant,
} from "./chore-times";

const LA = "America/Los_Angeles";

describe("chore times", () => {
  it("reads a server time without a zone as UTC, which is how the API stores it", () => {
    expect(parseServerInstant("2026-10-25T23:10:00").toISOString()).toBe(
      "2026-10-25T23:10:00.000Z",
    );
    expect(parseServerInstant("2026-10-25T23:10:00Z").toISOString()).toBe(
      "2026-10-25T23:10:00.000Z",
    );
    expect(parseServerInstant("2026-10-25T16:10:00-07:00").toISOString()).toBe(
      "2026-10-25T23:10:00.000Z",
    );
  });

  it("shows the time and day in the family's zone, not the device's", () => {
    // 05:30Z on the 26th is still the evening of the 25th in Los Angeles.
    const late = "2026-10-26T05:30:00Z";
    expect(formatTimeInZone(late, LA).replace(/\s/g, " ")).toBe("10:30 PM");
    expect(formatDayInZone(late, LA)).toBe("Sunday, October 25");
    expect(dayKeyInZone(late, LA)).toBe("2026-10-25");
  });

  it("gives a blank instead of crashing on a time it cannot read", () => {
    expect(formatTimeInZone("not a time", LA)).toBe("");
  });

  it("falls back to the device's zone when the family has none", () => {
    expect(() =>
      formatTimeInZone("2026-10-25T16:10:00Z", undefined),
    ).not.toThrow();
  });
});
