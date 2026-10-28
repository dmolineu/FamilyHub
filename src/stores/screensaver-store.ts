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

/** Hours when this device's screensaver is a dark screen instead of photos. */
export interface NightHours {
  enabled: boolean;
  /** "HH:mm" in the family's time zone. */
  from: string;
  to: string;
}

export const DEFAULT_NIGHT: NightHours = {
  enabled: false,
  from: "22:00",
  to: "06:30",
};

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function readNight(value: unknown): NightHours {
  const night = value as Partial<NightHours> | undefined;
  return night &&
    typeof night.enabled === "boolean" &&
    typeof night.from === "string" &&
    HH_MM.test(night.from) &&
    typeof night.to === "string" &&
    HH_MM.test(night.to)
    ? { enabled: night.enabled, from: night.from, to: night.to }
    : DEFAULT_NIGHT;
}

interface ScreensaverState {
  /** Per device, like the look: the wall and a phone choose separately. */
  delay: ScreensaverDelay;
  /** Showing right now (never persisted: a reload starts with the app). */
  isActive: boolean;
  /** Per device too: a wall in the kitchen goes dark at night, a phone does not care. */
  night: NightHours;
  setNight: (night: Partial<NightHours>) => void;
  setDelay: (delay: ScreensaverDelay) => void;
  start: () => void;
  stop: () => void;
}

export const useScreensaverStore = create<ScreensaverState>()(
  persist(
    (set) => ({
      delay: "auto",
      isActive: false,
      night: DEFAULT_NIGHT,
      setNight: (night) =>
        set((state) => ({ night: { ...state.night, ...night } })),
      setDelay: (delay) => set({ delay }),
      start: () => set({ isActive: true }),
      stop: () => set({ isActive: false }),
    }),
    {
      name: SCREENSAVER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ delay: state.delay, night: state.night }),
      // A value from a future or broken build falls back to the default.
      merge: (persisted, current) => {
        const stored = persisted as
          | { delay?: unknown; night?: unknown }
          | undefined;
        const delay = stored?.delay;
        return {
          ...current,
          delay: SCREENSAVER_DELAYS.includes(delay as ScreensaverDelay)
            ? (delay as ScreensaverDelay)
            : current.delay,
          night: readNight(stored?.night),
        };
      },
    },
  ),
);
