import { describe, expect, it } from "vitest";
import { memberThemeSelection, memberThemeValue } from "./member-theme";

const PACKS = [
  { id: "pack-1", name: "Jeep (desert)" },
  { id: "pack-2", name: "Padres (night)" },
];

describe("memberThemeSelection", () => {
  it("is null for someone on the screen's own look", () => {
    expect(memberThemeSelection(null, PACKS)).toBeNull();
    expect(memberThemeSelection(undefined, PACKS)).toBeNull();
  });

  it("reads a built-in look", () => {
    expect(memberThemeSelection("builtin:midnight", PACKS)).toEqual({
      kind: "builtin",
      id: "midnight",
    });
  });

  it("finds a pack by name, ignoring case, so a re-imported pack still matches", () => {
    expect(memberThemeSelection("pack:jeep (DESERT)", PACKS)).toEqual({
      kind: "pack",
      id: "pack-1",
    });
  });

  it("falls back to the screen's own look for a look or pack that is gone", () => {
    expect(memberThemeSelection("builtin:neon", PACKS)).toBeNull();
    expect(memberThemeSelection("pack:Deleted", PACKS)).toBeNull();
    expect(memberThemeSelection("rainbow", PACKS)).toBeNull();
  });
});

describe("memberThemeValue", () => {
  it("stores a built-in look by id, a pack by name, and nothing as null", () => {
    expect(memberThemeValue({ kind: "builtin", id: "sunrise" }, PACKS)).toBe(
      "builtin:sunrise",
    );
    expect(memberThemeValue({ kind: "pack", id: "pack-2" }, PACKS)).toBe(
      "pack:Padres (night)",
    );
    expect(memberThemeValue(null, PACKS)).toBeNull();
  });
});
