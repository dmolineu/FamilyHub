import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SCREENSAVER_STORAGE_KEY } from "@/lib/constants";

/**
 * How long the device sits untouched before the screensaver starts. "auto"
 * means 10 minutes on a wall-sized screen and never on phones and laptops,
 * which have their own screen locks.
 */
export type ScreensaverDelay = "auto" | "off" | 1 | 5 | 10 | 15 | 30 | 60;

export const SCREENSAVER_DELAYS: readonly ScreensaverDelay[] = [
  "auto",
  "off",
  1,
  5,
  10,
  15,
  30,
  60,
];

interface ScreensaverState {
  /** Per device, like the look: the wall and a phone choose separately. */
  delay: ScreensaverDelay;
  /** Showing right now (never persisted: a reload starts with the app). */
  isActive: boolean;
  setDelay: (delay: ScreensaverDelay) => void;
  start: () => void;
  stop: () => void;
}

export const useScreensaverStore = create<ScreensaverState>()(
  persist(
    (set) => ({
      delay: "auto",
      isActive: false,
      setDelay: (delay) => set({ delay }),
      start: () => set({ isActive: true }),
      stop: () => set({ isActive: false }),
    }),
    {
      name: SCREENSAVER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ delay: state.delay }),
      // A value from a future or broken build falls back to automatic.
      merge: (persisted, current) => {
        const delay = (persisted as { delay?: unknown } | undefined)?.delay;
        return SCREENSAVER_DELAYS.includes(delay as ScreensaverDelay)
          ? { ...current, delay: delay as ScreensaverDelay }
          : current;
      },
    },
  ),
);
