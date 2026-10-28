import { describe, expect, it } from "vitest";
import { fitEventCardVariant } from "./event-card-fit";

describe("fitEventCardVariant", () => {
  const rem = 22; // a 1080p wall

  it("keeps the full card when its title and time fit", () => {
    expect(fitEventCardVariant("default", 3 * rem, rem)).toBe("default");
  });

  it("drops to one line when the time would be cut through", () => {
    // A one-hour event on a 1080p wall: the title fits, the time row does not.
    expect(fitEventCardVariant("default", 46, rem)).toBe("slim");
  });

  it("drops a half-hour event to one line", () => {
    expect(fitEventCardVariant("default", 23, rem)).toBe("slim");
  });

  it("measures against the screen's own text size", () => {
    // The same 46px box holds the full card when the text is laptop-sized.
    expect(fitEventCardVariant("default", 46, 15)).toBe("default");
  });

  it("lets a narrow card keep its title until even one line would be cut", () => {
    expect(fitEventCardVariant("compact", 46, rem)).toBe("compact");
    expect(fitEventCardVariant("compact", 23, rem)).toBe("slim");
  });
});
