import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type AppliedPack,
  DEFAULT_THEME_SELECTION,
  isBuiltInThemeId,
  type ResolvedDocumentTheme,
  resolveDocumentTheme,
  type ThemeSelection,
} from "@/lib/themes";

/** One look all the time, or a daytime look and a night-time look that flip with the sun. */
export type ThemeMode = "single" | "sun";

export const DEFAULT_NIGHT_SELECTION: ThemeSelection = {
  kind: "builtin",
  id: "midnight",
};

interface ThemeData {
  mode: ThemeMode;
  /** The look in single mode. */
  selection: ThemeSelection;
  daySelection: ThemeSelection;
  nightSelection: ThemeSelection;
  /** Last sun evaluation; the applier keeps it current while in sun mode. */
  daytime: boolean;
  /** Imported packs cached on this device, by id, so looks paint offline and before load. */
  appliedPacks: Record<string, AppliedPack>;
}

interface ThemeDerived {
  /** What `<html>` carries right now. Persisted for the pre-React boot script. */
  resolved: ResolvedDocumentTheme;
  /** The cached pack in use, if the effective look is a pack. */
  activePackId: string | null;
}

interface ThemeActions {
  setMode: (mode: ThemeMode) => void;
  setSelection: (selection: ThemeSelection) => void;
  setDaySelection: (selection: ThemeSelection) => void;
  setNightSelection: (selection: ThemeSelection) => void;
  setDaytime: (daytime: boolean) => void;
  cachePack: (pack: AppliedPack) => void;
  /** Drops a pack from the cache; selections that used it fall back to the defaults. */
  forgetPack: (id: string) => void;
}

export type ThemeState = ThemeData & ThemeDerived & ThemeActions;

/** localStorage key; the boot script in index.html reads the same key. */
export const THEME_STORAGE_KEY = "family-hub-theme";

const DEFAULT_DATA: ThemeData = {
  mode: "single",
  selection: DEFAULT_THEME_SELECTION,
  daySelection: DEFAULT_THEME_SELECTION,
  nightSelection: DEFAULT_NIGHT_SELECTION,
  daytime: true,
  appliedPacks: {},
};

export function effectiveSelection(data: ThemeData): ThemeSelection {
  if (data.mode === "sun") {
    return data.daytime ? data.daySelection : data.nightSelection;
  }
  return data.selection;
}

function derive(data: ThemeData): ThemeDerived {
  const selection = effectiveSelection(data);
  const pack =
    selection.kind === "pack"
      ? (data.appliedPacks[selection.id] ?? null)
      : null;
  const resolved = resolveDocumentTheme(selection, pack);
  return {
    resolved,
    activePackId: resolved.theme === "pack" && pack ? pack.id : null,
  };
}

function pickData(state: ThemeData): ThemeData {
  return {
    mode: state.mode,
    selection: state.selection,
    daySelection: state.daySelection,
    nightSelection: state.nightSelection,
    daytime: state.daytime,
    appliedPacks: state.appliedPacks,
  };
}

function isSelection(value: unknown): value is ThemeSelection {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown; id?: unknown };
  if (v.kind === "builtin")
    return typeof v.id === "string" && isBuiltInThemeId(v.id);
  return v.kind === "pack" && typeof v.id === "string" && v.id.length > 0;
}

function isPack(value: unknown): value is AppliedPack {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AppliedPack>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.dark === "boolean" &&
    !!v.tokens &&
    typeof v.tokens === "object"
  );
}

/**
 * Turns whatever was persisted, by this version or the first one (a single
 * `appliedPack`), into valid store data. Anything unrecognised falls back to
 * the defaults so a broken preference can never block the app.
 */
export function migratePersistedTheme(raw: unknown): ThemeData {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const appliedPacks: Record<string, AppliedPack> = {};
  if (p.appliedPacks && typeof p.appliedPacks === "object") {
    for (const pack of Object.values(
      p.appliedPacks as Record<string, unknown>,
    )) {
      if (isPack(pack)) appliedPacks[pack.id] = pack;
    }
  }
  if (isPack(p.appliedPack)) appliedPacks[p.appliedPack.id] = p.appliedPack;
  return {
    mode: p.mode === "sun" ? "sun" : "single",
    selection: isSelection(p.selection) ? p.selection : DEFAULT_THEME_SELECTION,
    daySelection: isSelection(p.daySelection)
      ? p.daySelection
      : DEFAULT_THEME_SELECTION,
    nightSelection: isSelection(p.nightSelection)
      ? p.nightSelection
      : DEFAULT_NIGHT_SELECTION,
    daytime: typeof p.daytime === "boolean" ? p.daytime : true,
    appliedPacks,
  };
}

/**
 * Per-device look. Deliberately not part of family data: changing the look on
 * the wall must never change it on a phone.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      const update = (partial: Partial<ThemeData>) =>
        set((state) => {
          const data = { ...pickData(state), ...partial };
          return { ...partial, ...derive(data) };
        });
      return {
        ...DEFAULT_DATA,
        ...derive(DEFAULT_DATA),
        setMode: (mode) => update({ mode }),
        setSelection: (selection) => update({ selection }),
        setDaySelection: (daySelection) => update({ daySelection }),
        setNightSelection: (nightSelection) => update({ nightSelection }),
        setDaytime: (daytime) => update({ daytime }),
        cachePack: (pack) =>
          update({ appliedPacks: { ...get().appliedPacks, [pack.id]: pack } }),
        forgetPack: (id) =>
          set((state) => {
            const appliedPacks = { ...state.appliedPacks };
            delete appliedPacks[id];
            const dropped = (
              selection: ThemeSelection,
              fallback: ThemeSelection,
            ) =>
              selection.kind === "pack" && selection.id === id
                ? fallback
                : selection;
            const data: ThemeData = {
              ...pickData(state),
              appliedPacks,
              selection: dropped(state.selection, DEFAULT_THEME_SELECTION),
              daySelection: dropped(
                state.daySelection,
                DEFAULT_THEME_SELECTION,
              ),
              nightSelection: dropped(
                state.nightSelection,
                DEFAULT_NIGHT_SELECTION,
              ),
            };
            return { ...data, ...derive(data) };
          }),
      };
    },
    {
      name: THEME_STORAGE_KEY,
      partialize: (s) => {
        // Only packs a selection still names are worth keeping on the device.
        const wanted = new Set(
          [s.selection, s.daySelection, s.nightSelection]
            .filter((sel) => sel.kind === "pack")
            .map((sel) => sel.id),
        );
        const appliedPacks = Object.fromEntries(
          Object.entries(s.appliedPacks).filter(([id]) => wanted.has(id)),
        );
        return {
          mode: s.mode,
          selection: s.selection,
          daySelection: s.daySelection,
          nightSelection: s.nightSelection,
          daytime: s.daytime,
          appliedPacks,
          resolved: s.resolved,
          activePackId: s.activePackId,
        };
      },
      merge: (persisted, current) => {
        const data = migratePersistedTheme(persisted);
        return { ...current, ...data, ...derive(data) };
      },
    },
  ),
);

// Keep the derived fields honest when tests or tooling call setState directly.
useThemeStore.subscribe((state, previous) => {
  const changed = (
    [
      "mode",
      "selection",
      "daySelection",
      "nightSelection",
      "daytime",
      "appliedPacks",
    ] as const
  ).some((key) => state[key] !== previous[key]);
  if (!changed) return;
  const derived = derive(pickData(state));
  if (
    derived.resolved.theme !== state.resolved.theme ||
    derived.resolved.dark !== state.resolved.dark ||
    derived.activePackId !== state.activePackId
  ) {
    useThemeStore.setState(derived);
  }
});
