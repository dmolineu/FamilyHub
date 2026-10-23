import { beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, useThemeStore } from "./theme-store";

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({
    selection: { kind: "builtin", id: "default" },
    appliedPack: null,
  });
});

describe("useThemeStore", () => {
  it("starts on the Default look with no pack cached", () => {
    const s = useThemeStore.getState();
    expect(s.selection).toEqual({ kind: "builtin", id: "default" });
    expect(s.appliedPack).toBeNull();
    expect(s.resolved).toEqual({ theme: "default", dark: false });
  });

  it("selecting a built-in look resolves its document theme and dark flag", () => {
    useThemeStore.getState().setSelection({ kind: "builtin", id: "midnight" });
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "midnight",
      dark: true,
    });
    useThemeStore.getState().setSelection({ kind: "builtin", id: "sunrise" });
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "sunrise",
      dark: false,
    });
  });

  it("persists the selection and the resolved look under family-hub-theme, per device", () => {
    useThemeStore.getState().setSelection({ kind: "builtin", id: "midnight" });
    const persisted = JSON.parse(
      localStorage.getItem(THEME_STORAGE_KEY) ?? "{}",
    );
    expect(persisted.state.selection).toEqual({
      kind: "builtin",
      id: "midnight",
    });
    // The pre-React boot script reads these two fields to paint before load.
    expect(persisted.state.resolved).toEqual({ theme: "midnight", dark: true });
  });

  it("a pack selection only resolves to the pack while that pack is cached", () => {
    useThemeStore.getState().setSelection({ kind: "pack", id: "p1" });
    // Nothing cached yet: falls back to Default so the UI never goes blank.
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "default",
      dark: false,
    });
    useThemeStore.getState().setAppliedPack({
      id: "p1",
      name: "Padres",
      dark: true,
      tokens: { "--primary": "#ffc425" },
      images: {},
    });
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "pack",
      dark: true,
    });
    // A different cached pack does not satisfy the selection.
    useThemeStore.getState().setAppliedPack({
      id: "p2",
      name: "Other",
      dark: false,
      tokens: {},
      images: {},
    });
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "default",
      dark: false,
    });
  });
});
