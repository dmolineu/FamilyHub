import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type AppliedPack,
  DEFAULT_THEME_SELECTION,
  type ResolvedDocumentTheme,
  resolveDocumentTheme,
  type ThemeSelection,
} from "@/lib/themes";

interface ThemeState {
  /** The look this device has chosen. */
  selection: ThemeSelection;
  /** The imported pack cached locally so it paints offline and before load. */
  appliedPack: AppliedPack | null;
  /** Derived: what `<html>` carries. Persisted for the pre-React boot script. */
  resolved: ResolvedDocumentTheme;
  setSelection: (selection: ThemeSelection) => void;
  setAppliedPack: (pack: AppliedPack | null) => void;
}

/** localStorage key; the boot script in index.html reads the same key. */
export const THEME_STORAGE_KEY = "family-hub-theme";

/**
 * Per-device look. Deliberately not part of family data: changing the look on
 * the wall must never change it on a phone.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      selection: DEFAULT_THEME_SELECTION,
      appliedPack: null,
      resolved: resolveDocumentTheme(DEFAULT_THEME_SELECTION, null),
      setSelection: (selection) =>
        set((s) => ({
          selection,
          resolved: resolveDocumentTheme(selection, s.appliedPack),
        })),
      setAppliedPack: (appliedPack) =>
        set((s) => ({
          appliedPack,
          resolved: resolveDocumentTheme(s.selection, appliedPack),
        })),
    }),
    {
      name: THEME_STORAGE_KEY,
      partialize: (s) => ({
        selection: s.selection,
        appliedPack: s.appliedPack,
        resolved: s.resolved,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ThemeState>;
        const selection = p.selection ?? current.selection;
        const appliedPack = p.appliedPack ?? null;
        return {
          ...current,
          selection,
          appliedPack,
          resolved: resolveDocumentTheme(selection, appliedPack),
        };
      },
    },
  ),
);

// Keep `resolved` honest when tests or tooling call setState directly.
useThemeStore.subscribe((state, previous) => {
  if (
    state.selection !== previous.selection ||
    state.appliedPack !== previous.appliedPack
  ) {
    const resolved = resolveDocumentTheme(state.selection, state.appliedPack);
    if (
      resolved.theme !== state.resolved.theme ||
      resolved.dark !== state.resolved.dark
    ) {
      useThemeStore.setState({ resolved });
    }
  }
});
