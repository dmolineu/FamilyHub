import { afterEach, describe, expect, it } from "vitest";
import { applyDisplayToDocument, displayFromUrl } from "./display";

describe("display mode", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-display");
  });

  it("reads ?display=wall or ?display=standard from the address, and nothing else", () => {
    expect(displayFromUrl("?display=wall")).toBe("wall");
    expect(displayFromUrl("?foo=1&display=standard")).toBe("standard");
    expect(displayFromUrl("?display=huge")).toBeNull();
    expect(displayFromUrl("")).toBeNull();
  });

  it("marks the page for the wall's larger type, and clears it again", () => {
    applyDisplayToDocument("wall");
    expect(document.documentElement.getAttribute("data-display")).toBe("wall");
    applyDisplayToDocument("standard");
    expect(document.documentElement.hasAttribute("data-display")).toBe(false);
  });
});
