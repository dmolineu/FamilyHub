import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DISPLAY_STORAGE_KEY, type DisplayMode } from "@/lib/display";

interface DisplayState {
  /** Per device, like the look: the wall and a phone choose separately. */
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      mode: "standard",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: DISPLAY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);
