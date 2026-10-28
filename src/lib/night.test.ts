import { describe, expect, it } from "vitest";
import { isNightTime } from "./night";

const LA = "America/Los_Angeles";

describe("isNightTime", () => {
  it("covers a night that runs past midnight", () => {
    // 11:30 PM and 6:00 AM in Los Angeles are inside 22:00–06:30.
    expect(
      isNightTime(new Date("2026-10-28T06:30:00Z"), LA, "22:00", "06:30"),
    ).toBe(true);
    expect(
      isNightTime(new Date("2026-10-28T13:00:00Z"), LA, "22:00", "06:30"),
    ).toBe(true);
    // 7:00 AM and 9:59 PM are not.
    expect(
      isNightTime(new Date("2026-10-28T14:00:00Z"), LA, "22:00", "06:30"),
    ).toBe(false);
    expect(
      isNightTime(new Date("2026-10-28T04:59:00Z"), LA, "22:00", "06:30"),
    ).toBe(false);
  });

  it("starts on the minute it says and ends on the minute it says", () => {
    expect(
      isNightTime(new Date("2026-10-28T05:00:00Z"), LA, "22:00", "06:30"),
    ).toBe(true);
    expect(
      isNightTime(new Date("2026-10-28T13:30:00Z"), LA, "22:00", "06:30"),
    ).toBe(false);
  });

  it("covers a window within one day too", () => {
    expect(
      isNightTime(new Date("2026-10-28T09:00:00Z"), LA, "01:00", "05:00"),
    ).toBe(true);
    expect(
      isNightTime(new Date("2026-10-28T14:00:00Z"), LA, "01:00", "05:00"),
    ).toBe(false);
  });

  it("is never night when the window is empty or unreadable", () => {
    expect(
      isNightTime(new Date("2026-10-28T06:30:00Z"), LA, "22:00", "22:00"),
    ).toBe(false);
    expect(
      isNightTime(new Date("2026-10-28T06:30:00Z"), LA, "bad", "06:30"),
    ).toBe(false);
  });
});
