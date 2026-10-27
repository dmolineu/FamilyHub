import { describe, expect, it } from "vitest";
import {
  BUILT_IN_AVATARS,
  clampOffset,
  coverScale,
  initialOffset,
  parseAvatar,
  sourceRect,
  zoomAround,
} from "./avatars";

describe("parseAvatar", () => {
  it("treats no avatar as initials", () => {
    expect(parseAvatar(undefined)).toEqual({ kind: "initials" });
    expect(parseAvatar(null)).toEqual({ kind: "initials" });
    expect(parseAvatar("")).toEqual({ kind: "initials" });
  });

  it("recognises built-in pictures it knows, and falls back for ones it does not", () => {
    expect(parseAvatar("builtin:fox")).toEqual({ kind: "builtin", key: "fox" });
    expect(parseAvatar("builtin:dragon")).toEqual({ kind: "initials" });
  });

  it("shows pictures and https links as images", () => {
    expect(parseAvatar("data:image/png;base64,AAAA")).toEqual({
      kind: "image",
      src: "data:image/png;base64,AAAA",
    });
    expect(parseAvatar("https://example.com/a.jpg")).toEqual({
      kind: "image",
      src: "https://example.com/a.jpg",
    });
    expect(parseAvatar("javascript:alert(1)")).toEqual({ kind: "initials" });
  });

  it("offers a dozen built-in pictures, each with a name", () => {
    expect(BUILT_IN_AVATARS.length).toBeGreaterThanOrEqual(12);
    for (const avatar of BUILT_IN_AVATARS) {
      expect(avatar.key).toMatch(/^[a-z0-9-]+$/);
      expect(avatar.name.length).toBeGreaterThan(0);
    }
  });
});

describe("photo crop maths", () => {
  // A 400×200 landscape photo in a 200 px circle.
  const W = 400;
  const H = 200;
  const V = 200;

  it("scales the photo so its short side fills the circle at zoom 1", () => {
    expect(coverScale(W, H, V, 1)).toBe(1);
    expect(coverScale(W, H, V, 2)).toBe(2);
    expect(coverScale(1000, 3000, V, 1)).toBeCloseTo(0.2);
  });

  it("starts centred", () => {
    expect(initialOffset(W, H, V, 1)).toEqual({ x: -100, y: 0 });
  });

  it("never lets the photo uncover the circle", () => {
    const s = coverScale(W, H, V, 1);
    expect(clampOffset({ x: 50, y: 10 }, W, H, V, s)).toEqual({ x: 0, y: 0 });
    expect(clampOffset({ x: -500, y: -10 }, W, H, V, s)).toEqual({
      x: -200,
      y: 0,
    });
  });

  it("zooms around the centre of the circle", () => {
    // Centred at zoom 1 (left -100): the circle's centre is the photo's centre.
    const next = zoomAround({ x: -100, y: 0 }, W, H, V, 1, 2);
    // At zoom 2 the photo is 800×400; centring it puts its left edge at -300.
    expect(next).toEqual({ x: -300, y: -100 });
  });

  it("maps the visible circle back to a square of the original photo", () => {
    expect(sourceRect({ x: -100, y: 0 }, coverScale(W, H, V, 1), V)).toEqual({
      sx: 100,
      sy: 0,
      size: 200,
    });
    expect(sourceRect({ x: -300, y: -100 }, coverScale(W, H, V, 2), V)).toEqual(
      { sx: 150, sy: 50, size: 100 },
    );
  });
});

describe("dataUrlBytes", () => {
  it("counts the bytes a base64 data URL holds", async () => {
    const { dataUrlBytes } = await import("./avatar-images");
    expect(dataUrlBytes("data:image/png;base64,AAAA")).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,AAA=")).toBe(2);
    expect(dataUrlBytes("data:image/png;base64,AA==")).toBe(1);
  });
});
