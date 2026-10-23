import { beforeEach, describe, expect, it } from "vitest";
import {
  applyThemeToDocument,
  BUILT_IN_THEMES,
  isBuiltInThemeId,
  resolveDocumentTheme,
} from "./themes";

function root(): HTMLElement {
  return document.documentElement;
}

beforeEach(() => {
  root().removeAttribute("data-theme");
  root().classList.remove("dark");
  root().removeAttribute("style");
});

describe("built-in themes", () => {
  it("offers Default, Midnight and Sunrise, with Midnight the dark one", () => {
    expect(BUILT_IN_THEMES.map((t) => t.id)).toEqual([
      "default",
      "midnight",
      "sunrise",
    ]);
    expect(BUILT_IN_THEMES.filter((t) => t.dark).map((t) => t.id)).toEqual([
      "midnight",
    ]);
    expect(isBuiltInThemeId("midnight")).toBe(true);
    expect(isBuiltInThemeId("pokemon")).toBe(false);
  });
});

describe("resolveDocumentTheme", () => {
  it("maps a built-in selection to its id and dark flag", () => {
    expect(
      resolveDocumentTheme({ kind: "builtin", id: "midnight" }, null),
    ).toEqual({ theme: "midnight", dark: true });
  });

  it("maps a pack selection to 'pack' only when the cached pack matches", () => {
    const pack = { id: "p1", name: "X", dark: true, tokens: {}, images: {} };
    expect(resolveDocumentTheme({ kind: "pack", id: "p1" }, pack)).toEqual({
      theme: "pack",
      dark: true,
    });
    expect(resolveDocumentTheme({ kind: "pack", id: "p9" }, pack)).toEqual({
      theme: "default",
      dark: false,
    });
  });
});

describe("applyThemeToDocument", () => {
  it("sets data-theme and the dark class for a built-in look", () => {
    applyThemeToDocument({ kind: "builtin", id: "midnight" }, null);
    expect(root().dataset.theme).toBe("midnight");
    expect(root().classList.contains("dark")).toBe(true);

    applyThemeToDocument({ kind: "builtin", id: "default" }, null);
    expect(root().dataset.theme).toBe("default");
    expect(root().classList.contains("dark")).toBe(false);
  });

  it("writes a pack's tokens and images as inline custom properties and clears them again", () => {
    applyThemeToDocument(
      { kind: "pack", id: "p1" },
      {
        id: "p1",
        name: "Padres",
        dark: true,
        tokens: {
          "--primary": "#ffc425",
          "--background": "#2f241d",
          "not-a-token": "red", // ignored: not a custom property name
          "--evil": "red; } body { display: none", // ignored: unsafe value
        },
        images: {
          "home-banner": "data:image/png;base64,iVBORw0KGgo=",
          bad: "javascript:alert(1)", // ignored: not an image data URL
        },
      },
    );
    expect(root().dataset.theme).toBe("pack");
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().style.getPropertyValue("--primary")).toBe("#ffc425");
    expect(root().style.getPropertyValue("--background")).toBe("#2f241d");
    expect(root().style.getPropertyValue("--evil")).toBe("");
    expect(root().style.getPropertyValue("--theme-image-home-banner")).toBe(
      'url("data:image/png;base64,iVBORw0KGgo=")',
    );
    expect(root().style.getPropertyValue("--theme-image-bad")).toBe("");

    // Switching back to a built-in look removes every inline token.
    applyThemeToDocument({ kind: "builtin", id: "sunrise" }, null);
    expect(root().dataset.theme).toBe("sunrise");
    expect(root().classList.contains("dark")).toBe(false);
    expect(root().style.getPropertyValue("--primary")).toBe("");
    expect(root().style.getPropertyValue("--theme-image-home-banner")).toBe("");
  });

  it("falls back to Default when the selected pack is not the cached one", () => {
    applyThemeToDocument({ kind: "pack", id: "missing" }, null);
    expect(root().dataset.theme).toBe("default");
    expect(root().classList.contains("dark")).toBe(false);
  });

  it("keeps the browser chrome colour in step with the look", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#faf8f5");
    document.head.appendChild(meta);
    try {
      applyThemeToDocument({ kind: "builtin", id: "midnight" }, null);
      expect(meta.getAttribute("content")).not.toBe("#faf8f5");
      applyThemeToDocument(
        { kind: "pack", id: "p1" },
        {
          id: "p1",
          name: "P",
          dark: true,
          tokens: { "--background": "#2f241d" },
          images: {},
        },
      );
      expect(meta.getAttribute("content")).toBe("#2f241d");
    } finally {
      meta.remove();
    }
  });
});
