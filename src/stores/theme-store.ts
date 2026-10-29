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

/**
 * Someone's own look, shown on this screen after they were tapped. It covers
 * the screen's own look (single or sun) until the family's revert time passes
 * untouched, or another tap or a new screen look replaces it.
 */
export interface PersonTheme {
  memberId: string;
  /** Their look when they were tapped; followed if they change it. */
  selection: ThemeSelection;
  /** When this screen was last touched while their look showed (epoch ms). */
  lastActiveAt: number;
}

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
  /** Someone's own look over the screen's, or null. Kept across reloads. */
  person: PersonTheme | null;
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
  /** Shows someone's own look on this screen, or (null) the screen's own again. */
  showPerson: (person: PersonTheme | null) => void;
  /** Records a touch while someone's look shows, for the revert countdown. */
  notePersonActivity: (at: number) => void;
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
  person: null,
};

export function effectiveSelection(data: ThemeData): ThemeSelection {
  if (data.person) return data.person.selection;
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
    person: state.person,
  };
}

function isSelection(value: unknown): value is ThemeSelection {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown; id?: unknown };
  if (v.kind === "builtin")
    return typeof v.id === "string" && isBuiltInThemeId(v.id);
  return v.kind === "pack" && typeof v.id === "string" && v.id.length > 0;
}

function isPerson(value: unknown): value is PersonTheme {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PersonTheme>;
  return (
    typeof v.memberId === "string" &&
    v.memberId.length > 0 &&
    isSelection(v.selection) &&
    typeof v.lastActiveAt === "number"
  );
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
    person: isPerson(p.person) ? p.person : null,
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
        // Choosing this screen's own look replaces anyone's look shown over it.
        setMode: (mode) => update({ mode, person: null }),
        setSelection: (selection) => update({ selection, person: null }),
        setDaySelection: (daySelection) =>
          update({ daySelection, person: null }),
        setNightSelection: (nightSelection) =>
          update({ nightSelection, person: null }),
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
              person:
                state.person?.selection.kind === "pack" &&
                state.person.selection.id === id
                  ? null
                  : state.person,
            };
            return { ...data, ...derive(data) };
          }),
        showPerson: (person) => update({ person }),
        notePersonActivity: (at) => {
          const person = get().person;
          if (person) update({ person: { ...person, lastActiveAt: at } });
        },
      };
    },
    {
      name: THEME_STORAGE_KEY,
      partialize: (s) => {
        // Only packs a selection still names are worth keeping on the device.
        const wanted = new Set(
          [s.selection, s.daySelection, s.nightSelection, s.person?.selection]
            .filter((sel): sel is ThemeSelection => sel?.kind === "pack")
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
          person: s.person,
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
      "person",
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
