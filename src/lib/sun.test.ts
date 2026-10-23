import { describe, expect, it } from "vitest";
import {
  approximateCoordinates,
  isDaytime,
  nextSunBoundary,
  sunTimes,
} from "./sun";

const SAN_DIEGO = { latitude: 32.7157, longitude: -117.1647 };
const LA = "America/Los_Angeles";

function minutesApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 60000;
}

describe("sunTimes", () => {
  it("matches NOAA within ten minutes for San Diego at the solstices", () => {
    // NOAA: 2026-06-21 sunrise 05:41 PDT, sunset 19:59 PDT.
    const june = sunTimes(new Date("2026-06-21T19:00:00Z"), SAN_DIEGO, LA);
    expect(june.kind).toBe("normal");
    expect(
      minutesApart(june.sunrise, new Date("2026-06-21T12:41:00Z")),
    ).toBeLessThan(10);
    expect(
      minutesApart(june.sunset, new Date("2026-06-22T02:59:00Z")),
    ).toBeLessThan(10);

    // NOAA: 2026-12-21 sunrise 06:48 PST, sunset 16:47 PST.
    const december = sunTimes(new Date("2026-12-21T20:00:00Z"), SAN_DIEGO, LA);
    expect(
      minutesApart(december.sunrise, new Date("2026-12-21T14:48:00Z")),
    ).toBeLessThan(10);
    expect(
      minutesApart(december.sunset, new Date("2026-12-22T00:47:00Z")),
    ).toBeLessThan(10);
  });

  it("uses the local calendar day of the zone, not UTC's", () => {
    // 2026-06-21 23:30 PDT is already 06:30Z on the 22nd; the times must be the 21st's.
    const late = sunTimes(new Date("2026-06-22T06:30:00Z"), SAN_DIEGO, LA);
    expect(late.sunrise.toISOString()).toMatch(/^2026-06-21T12:4/);
  });

  it("reports polar day and polar night instead of inventing times", () => {
    const svalbard = { latitude: 78.2, longitude: 15.6 };
    expect(
      sunTimes(
        new Date("2026-06-21T12:00:00Z"),
        svalbard,
        "Arctic/Longyearbyen",
      ).kind,
    ).toBe("polar-day");
    expect(
      sunTimes(
        new Date("2026-12-21T12:00:00Z"),
        svalbard,
        "Arctic/Longyearbyen",
      ).kind,
    ).toBe("polar-night");
  });
});

describe("isDaytime", () => {
  it("is true between sunrise and sunset and false outside", () => {
    expect(isDaytime(new Date("2026-06-21T20:00:00Z"), SAN_DIEGO, LA)).toBe(
      true,
    ); // 1 pm
    expect(isDaytime(new Date("2026-06-21T10:00:00Z"), SAN_DIEGO, LA)).toBe(
      false,
    ); // 3 am
    expect(isDaytime(new Date("2026-06-22T04:00:00Z"), SAN_DIEGO, LA)).toBe(
      false,
    ); // 9 pm
  });

  it("treats polar day as day and polar night as night", () => {
    const svalbard = { latitude: 78.2, longitude: 15.6 };
    expect(
      isDaytime(
        new Date("2026-06-21T00:30:00Z"),
        svalbard,
        "Arctic/Longyearbyen",
      ),
    ).toBe(true);
    expect(
      isDaytime(
        new Date("2026-12-21T12:00:00Z"),
        svalbard,
        "Arctic/Longyearbyen",
      ),
    ).toBe(false);
  });
});

describe("nextSunBoundary", () => {
  it("is today's sunset during the day and tomorrow's sunrise after sunset", () => {
    const noon = new Date("2026-06-21T19:00:00Z");
    const boundaryFromNoon = nextSunBoundary(noon, SAN_DIEGO, LA);
    expect(boundaryFromNoon.getTime()).toBeGreaterThan(noon.getTime());
    expect(
      minutesApart(boundaryFromNoon, new Date("2026-06-22T02:59:00Z")),
    ).toBeLessThan(10);

    const night = new Date("2026-06-22T05:00:00Z"); // 10 pm on the 21st
    const boundaryFromNight = nextSunBoundary(night, SAN_DIEGO, LA);
    expect(
      minutesApart(boundaryFromNight, new Date("2026-06-22T12:41:00Z")),
    ).toBeLessThan(10);
  });

  it("falls back to a few hours ahead in polar conditions so the check keeps running", () => {
    const svalbard = { latitude: 78.2, longitude: 15.6 };
    const now = new Date("2026-06-21T12:00:00Z");
    const next = nextSunBoundary(now, svalbard, "Arctic/Longyearbyen");
    expect(next.getTime() - now.getTime()).toBeGreaterThan(60 * 60 * 1000);
    expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(
      6 * 60 * 60 * 1000,
    );
  });
});

describe("approximateCoordinates", () => {
  it("places a zone by its UTC offset when the family has no weather location", () => {
    // Pacific daylight time is UTC-7 → about 105° W; the latitude is a mid-latitude guess.
    const la = approximateCoordinates(LA, new Date("2026-06-21T19:00:00Z"));
    expect(la.longitude).toBeCloseTo(-105, 0);
    expect(la.latitude).toBeGreaterThan(20);
    expect(la.latitude).toBeLessThan(50);
    expect(la.approximate).toBe(true);

    const tokyo = approximateCoordinates(
      "Asia/Tokyo",
      new Date("2026-06-21T19:00:00Z"),
    );
    expect(tokyo.longitude).toBeCloseTo(135, 0);
  });

  it("copes with an unknown zone by assuming UTC", () => {
    const unknown = approximateCoordinates(
      "Not/AZone",
      new Date("2026-06-21T19:00:00Z"),
    );
    expect(unknown.longitude).toBe(0);
  });
});
