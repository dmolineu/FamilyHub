import { useEffect, useLayoutEffect } from "react";
import { useFamilyData } from "@/api";
import {
  approximateCoordinates,
  type Coordinates,
  isDaytime,
  nextSunBoundary,
} from "@/lib/sun";
import { applyThemeToDocument } from "@/lib/themes";
import { effectiveSelection, useThemeStore } from "@/stores/theme-store";

/** Re-evaluate at least this often even when the next sun event is far off. */
const MAX_WAIT_MS = 15 * 60 * 1000;

interface FamilyLike {
  timezone?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SunContext {
  timeZone: string;
  coordinates: Coordinates;
  /** True when the spot is guessed from the time zone, not the weather location. */
  approximate: boolean;
}

/**
 * Where and in which zone to compute sunrise and sunset: the family's geocoded
 * weather location when it has one, else a guess from its time zone (or the
 * device's zone before any family is loaded).
 */
export function sunContextFor(family: FamilyLike | null): SunContext {
  const timeZone =
    family?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";
  if (
    family &&
    typeof family.latitude === "number" &&
    typeof family.longitude === "number"
  ) {
    return {
      timeZone,
      coordinates: { latitude: family.latitude, longitude: family.longitude },
      approximate: false,
    };
  }
  const guess = approximateCoordinates(timeZone);
  return {
    timeZone,
    coordinates: { latitude: guess.latitude, longitude: guess.longitude },
    approximate: true,
  };
}

/**
 * Paints the device's effective look onto `<html>` and keeps it in step with
 * the theme store. In sun mode it also keeps the store's daytime flag current,
 * re-checking at the next sunrise or sunset (and at least every 15 minutes).
 * Mounted once at the app root; the boot script in index.html paints the last
 * resolved look before React loads so there is no flash.
 */
export function useApplyTheme(): void {
  const family = useFamilyData();
  const mode = useThemeStore((s) => s.mode);
  const selection = useThemeStore(effectiveSelection);
  const activePack = useThemeStore((s) =>
    s.activePackId ? (s.appliedPacks[s.activePackId] ?? null) : null,
  );
  const timeZone = family?.timezone;
  const latitude = family?.latitude;
  const longitude = family?.longitude;

  useEffect(() => {
    if (mode !== "sun") return;
    const sun = sunContextFor({ timezone: timeZone, latitude, longitude });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = new Date();
      useThemeStore
        .getState()
        .setDaytime(isDaytime(now, sun.coordinates, sun.timeZone));
      const untilNext =
        nextSunBoundary(now, sun.coordinates, sun.timeZone).getTime() -
        now.getTime() +
        1000;
      timer = setTimeout(
        tick,
        Math.min(Math.max(untilNext, 1000), MAX_WAIT_MS),
      );
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [mode, timeZone, latitude, longitude]);

  useLayoutEffect(() => {
    applyThemeToDocument(selection, activePack);
  }, [selection, activePack]);
}
