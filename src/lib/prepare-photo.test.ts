import { describe, expect, it } from "vitest";
import { fitWithin, MAX_UPLOAD_EDGE } from "./prepare-photo";

describe("fitWithin", () => {
  it("shrinks a phone photo so its long edge is 1920", () => {
    expect(fitWithin(4032, 3024, MAX_UPLOAD_EDGE)).toEqual({
      width: 1920,
      height: 1440,
    });
    expect(fitWithin(3024, 4032, MAX_UPLOAD_EDGE)).toEqual({
      width: 1440,
      height: 1920,
    });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(800, 600, MAX_UPLOAD_EDGE)).toEqual({
      width: 800,
      height: 600,
    });
  });
});
