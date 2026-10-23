import { beforeEach, describe, expect, it } from "vitest";
import type { AppliedPack } from "@/lib/themes";
import {
  effectiveSelection,
  migratePersistedTheme,
  THEME_STORAGE_KEY,
  useThemeStore,
} from "./theme-store";

const PADRES: AppliedPack = {
  id: "p1",
  name: "Padres",
  dark: true,
  tokens: { "--primary": "#ffc425" },
  images: {},
};
const POKEMON: AppliedPack = {
  id: "p2",
  name: "Pokémon",
  dark: false,
  tokens: { "--primary": "#e3350d" },
  images: {},
};

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({
    mode: "single",
    selection: { kind: "builtin", id: "default" },
    daySelection: { kind: "builtin", id: "default" },
    nightSelection: { kind: "builtin", id: "midnight" },
    daytime: true,
    appliedPacks: {},
  });
});

describe("useThemeStore", () => {
  it("starts on a single Default look, with Default/Midnight as the day/night pair", () => {
    const s = useThemeStore.getState();
    expect(s.mode).toBe("single");
    expect(s.selection).toEqual({ kind: "builtin", id: "default" });
    expect(s.daySelection).toEqual({ kind: "builtin", id: "default" });
    expect(s.nightSelection).toEqual({ kind: "builtin", id: "midnight" });
    expect(s.resolved).toEqual({ theme: "default", dark: false });
    expect(s.activePackId).toBeNull();
  });

  it("in single mode the chosen look is the effective one", () => {
    useThemeStore.getState().setSelection({ kind: "builtin", id: "sunrise" });
    expect(effectiveSelection(useThemeStore.getState())).toEqual({
      kind: "builtin",
      id: "sunrise",
    });
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "sunrise",
      dark: false,
    });
  });

  it("in sun mode the daytime flag picks between the day and night looks", () => {
    const s = useThemeStore.getState();
    s.setSelection({ kind: "builtin", id: "sunrise" }); // ignored while in sun mode
    s.setMode("sun");
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "default",
      dark: false,
    });
    useThemeStore.getState().setDaytime(false);
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "midnight",
      dark: true,
    });
    useThemeStore
      .getState()
      .setDaySelection({ kind: "builtin", id: "sunrise" });
    useThemeStore.getState().setDaytime(true);
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "sunrise",
      dark: false,
    });
  });

  it("caches packs by id and resolves whichever the effective selection names", () => {
    const s = useThemeStore.getState();
    s.cachePack(PADRES);
    s.cachePack(POKEMON);
    s.setMode("sun");
    s.setDaySelection({ kind: "pack", id: "p2" });
    s.setNightSelection({ kind: "pack", id: "p1" });

    useThemeStore.getState().setDaytime(true);
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "pack",
      dark: false,
    });
    expect(useThemeStore.getState().activePackId).toBe("p2");

    useThemeStore.getState().setDaytime(false);
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "pack",
      dark: true,
    });
    expect(useThemeStore.getState().activePackId).toBe("p1");
  });

  it("a pack selection without a cached pack falls back to Default", () => {
    useThemeStore.getState().setSelection({ kind: "pack", id: "missing" });
    expect(useThemeStore.getState().resolved).toEqual({
      theme: "default",
      dark: false,
    });
    expect(useThemeStore.getState().activePackId).toBeNull();
  });

  it("forgetting a pack drops it from the cache and from every selection that used it", () => {
    const s = useThemeStore.getState();
    s.cachePack(PADRES);
    s.setSelection({ kind: "pack", id: "p1" });
    s.setNightSelection({ kind: "pack", id: "p1" });
    useThemeStore.getState().forgetPack("p1");
    const after = useThemeStore.getState();
    expect(after.appliedPacks).toEqual({});
    expect(after.selection).toEqual({ kind: "builtin", id: "default" });
    expect(after.nightSelection).toEqual({ kind: "builtin", id: "midnight" });
  });

  it("persists everything the boot script and the next session need", () => {
    const s = useThemeStore.getState();
    s.cachePack(PADRES);
    s.setMode("sun");
    s.setNightSelection({ kind: "pack", id: "p1" });
    useThemeStore.getState().setDaytime(false);

    const persisted = JSON.parse(
      localStorage.getItem(THEME_STORAGE_KEY) ?? "{}",
    ).state;
    expect(persisted.mode).toBe("sun");
    expect(persisted.nightSelection).toEqual({ kind: "pack", id: "p1" });
    expect(persisted.daytime).toBe(false);
    expect(persisted.resolved).toEqual({ theme: "pack", dark: true });
    expect(persisted.activePackId).toBe("p1");
    expect(persisted.appliedPacks.p1.name).toBe("Padres");
  });

  it("only keeps cached packs that a selection still refers to", () => {
    const s = useThemeStore.getState();
    s.cachePack(PADRES);
    s.cachePack(POKEMON);
    s.setSelection({ kind: "pack", id: "p1" });
    const persisted = JSON.parse(
      localStorage.getItem(THEME_STORAGE_KEY) ?? "{}",
    ).state;
    expect(Object.keys(persisted.appliedPacks)).toEqual(["p1"]);
  });
});

describe("migratePersistedTheme", () => {
  it("lifts the first version's single cached pack into the cache map", () => {
    const migrated = migratePersistedTheme({
      selection: { kind: "pack", id: "p1" },
      appliedPack: PADRES,
    });
    expect(migrated.mode).toBe("single");
    expect(migrated.selection).toEqual({ kind: "pack", id: "p1" });
    expect(migrated.appliedPacks).toEqual({ p1: PADRES });
    expect(migrated.nightSelection).toEqual({
      kind: "builtin",
      id: "midnight",
    });
  });

  it("tolerates junk by falling back to defaults", () => {
    const migrated = migratePersistedTheme({ selection: "nope", mode: 42 });
    expect(migrated.mode).toBe("single");
    expect(migrated.selection).toEqual({ kind: "builtin", id: "default" });
    expect(migrated.appliedPacks).toEqual({});
  });
});
