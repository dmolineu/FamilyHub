import { useEffect } from "react";
import { type ScreensaverDelay, useScreensaverStore } from "@/stores";
import { useIsLargeScreen } from "./use-is-large-screen";

/** "Automatic" on a wall-sized screen. */
export const AUTO_SCREENSAVER_MINUTES = 10;

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
] as const;

/**
 * Milliseconds of idle time before the screensaver, or null for never.
 * Automatic means the wall only: phones and laptops lock their own screens.
 */
export function resolveScreensaverMs(
  delay: ScreensaverDelay,
  isLargeScreen: boolean,
): number | null {
  if (delay === "off") return null;
  if (delay === "auto") {
    return isLargeScreen ? AUTO_SCREENSAVER_MINUTES * 60 * 1000 : null;
  }
  return delay * 60 * 1000;
}

/**
 * Starts the screensaver after this device's idle time. Any touch, key or
 * scroll restarts the count. Unlike the return-to-Home timer, an open dialog
 * does not hold it off: the screensaver only covers the screen, and whatever
 * was open is still there when it is dismissed.
 */
export function useScreensaverIdle(enabled: boolean): void {
  const delay = useScreensaverStore((s) => s.delay);
  const isActive = useScreensaverStore((s) => s.isActive);
  const isLargeScreen = useIsLargeScreen();
  const idleMs = resolveScreensaverMs(delay, isLargeScreen);

  useEffect(() => {
    if (!enabled || idleMs === null || isActive) return;

    let timer: ReturnType<typeof window.setTimeout> | null = null;
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(
        () => useScreensaverStore.getState().start(),
        idleMs,
      );
    };

    schedule();
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, schedule, { passive: true });
    }
    return () => {
      if (timer) window.clearTimeout(timer);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, schedule);
      }
    };
  }, [enabled, idleMs, isActive]);
}
