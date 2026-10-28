import { type RefObject, useEffect, useState } from "react";

/** Rows never get shorter than this, so a 30-minute event stays tappable. */
const MIN_FITTED_ROW = 36;

/**
 * The hour-row height for a time grid. On a wall the rows stretch (or shrink, down to
 * a tappable minimum) so the whole day fits the grid's height without scrolling, read
 * from across the room; elsewhere the usual height is kept.
 */
export function useFitHourRows(
  container: RefObject<HTMLElement | null>,
  baseHeight: number,
  rows: number,
  wall: boolean,
): number {
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    if (!wall) return;
    const measure = () => setAvailable(container.current?.clientHeight ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [container, wall]);

  if (!wall || !available) return baseHeight;
  return Math.max(MIN_FITTED_ROW, Math.floor(available / rows));
}
