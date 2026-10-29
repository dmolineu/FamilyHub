import { describe, expect, it } from "vitest";
import { colorMap, type FamilyColor } from "@/lib/types";
import {
  contrastRatio,
  isCustomColor,
  memberColor,
  readableTextOn,
} from "./member-color";

function addedCss(): string {
  return [...document.querySelectorAll("style")]
    .map((style) => style.textContent ?? "")
    .join("\n");
}

function hexOf(className: string): string {
  const match = /\[(#[0-9a-f]{6})\]$/.exec(className);
  if (!match) throw new Error(`no colour in ${className}`);
  return match[1];
}

describe("memberColor", () => {
  it("gives a named colour its palette classes", () => {
    expect(memberColor("teal")).toEqual(colorMap.teal);
  });

  it("gives a custom colour classes shaped like the palette's", () => {
    const colors = memberColor("#4A90D9" as FamilyColor);

    expect(colors.hex).toBe("#4a90d9");
    expect(colors.bg).toBe("bg-[#4a90d9]");
    expect(colors.text).toMatch(/^text-\[#[0-9a-f]{6}\]$/);
    expect(colors.light).toMatch(/^bg-\[#[0-9a-f]{6}\]$/);
  });

  it("adds the CSS behind a custom colour's classes, once", () => {
    memberColor("#3b7d2a");
    memberColor("#3b7d2a");

    const css = addedCss();
    expect(css.split(".bg-\\[\\#3b7d2a\\]")).toHaveLength(2);
    expect(css).toContain("background-color: #3b7d2a");
    const text = hexOf(memberColor("#3b7d2a").text).slice(1);
    expect(css).toContain(`.text-\\[\\#${text}\\]`);
  });

  it("keeps white text readable on a dark colour and switches to dark text on a pale one", () => {
    expect(readableTextOn("#1b2a4a")).toBe("#ffffff");
    expect(readableTextOn("#f7f3a1")).not.toBe("#ffffff");
    for (const hex of ["#f7f3a1", "#1b2a4a", "#ff00ff", "#7f7f7f"]) {
      expect(contrastRatio(readableTextOn(hex), hex)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("makes the text colour readable on white and on the light tint", () => {
    for (const hex of ["#f7f3a1", "#4a90d9", "#00ff00", "#1b2a4a"] as const) {
      const colors = memberColor(hex);
      const text = hexOf(colors.text);
      expect(contrastRatio(text, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, hexOf(colors.light))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("falls back to coral for a value it does not know", () => {
    expect(memberColor("ultraviolet" as FamilyColor)).toEqual(colorMap.coral);
  });
});

describe("isCustomColor", () => {
  it("is true only for #rrggbb", () => {
    expect(isCustomColor("#4a90d9")).toBe(true);
    expect(isCustomColor("#4A90D9")).toBe(true);
    expect(isCustomColor("teal")).toBe(false);
    expect(isCustomColor("#4a90d")).toBe(false);
  });
});
