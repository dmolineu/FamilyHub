import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SportsState {
  /** Per device: the calendar's "Sports" pill hides followed teams' games. */
  hideSports: boolean;
  /**
   * Games whose hidden score someone revealed on this device. Never persisted: a
   * reload hides them again, as no one may have wanted to see them.
   */
  revealedGameIds: string[];
  setHideSports: (hide: boolean) => void;
  reveal: (gameId: string) => void;
}

export const useSportsStore = create<SportsState>()(
  persist(
    (set) => ({
      hideSports: false,
      revealedGameIds: [],
      setHideSports: (hideSports) => set({ hideSports }),
      reveal: (gameId) =>
        set((state) =>
          state.revealedGameIds.includes(gameId)
            ? state
            : { revealedGameIds: [...state.revealedGameIds, gameId] },
        ),
    }),
    {
      name: "family-hub-sports",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ hideSports: state.hideSports }),
    },
  ),
);
