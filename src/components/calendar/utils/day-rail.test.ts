import { describe, expect, it } from "vitest";
import {
  MIN_LANE_WIDTH,
  RAIL_WIDTH,
  railThresholdPx,
  railWidthRem,
} from "./day-rail";

describe("day-rail math", () => {
  it("threshold grows with member count and accounts for the desktop nav", () => {
    expect(railThresholdPx(3)).toBeLessThan(railThresholdPx(6));
    // 3 comfortable lanes + axis + rail + the 80px desktop nav fit a ~13" laptop
    // (~1280) but need more than a bare 1024...
    expect(railThresholdPx(3)).toBeGreaterThan(1024);
    expect(railThresholdPx(3)).toBeLessThanOrEqual(1120);
    // ...and 6 lanes must not fit until well past 1440 (rail yields width to lanes).
    expect(railThresholdPx(6)).toBeGreaterThan(1440);
  });

  it("uses the documented lane/rail widths", () => {
    expect(RAIL_WIDTH).toBe(300);
    expect(MIN_LANE_WIDTH).toBeGreaterThanOrEqual(160);
  });

  it("grows with the page's text size, which the wall raises", () => {
    expect(railThresholdPx(4, 16)).toBe(railThresholdPx(4));
    expect(railThresholdPx(4, 32)).toBe(2 * railThresholdPx(4));
  });

  it("counts the wall's wider rail, which seats seven full-size day buttons", () => {
    expect(railWidthRem(false)).toBe(RAIL_WIDTH / 16);
    // Seven 2.75rem buttons and the rail's 0.75rem padding each side.
    expect(railWidthRem(true)).toBeGreaterThanOrEqual(7 * 2.75 + 1.5);
    expect(railThresholdPx(4, 22, true) - railThresholdPx(4, 22)).toBe(
      (railWidthRem(true) - railWidthRem(false)) * 22,
    );
  });
});
