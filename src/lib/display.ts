/**
 * How this device lays the app out. "wall" is for a screen read from across the
 * room: everything sized in rem (text, spacing, tap targets) grows together, and the
 * hour grids stretch to fit the screen. Chosen per device in Settings → This screen or with
 * `?display=wall` in the wall's kiosk address; phones and laptops stay "standard".
 */
export type DisplayMode = "standard" | "wall";

export const DISPLAY_STORAGE_KEY = "family-hub-display";

/** The mode asked for in the address (`?display=wall|standard`), if any. */
export function displayFromUrl(search: string): DisplayMode | null {
  const value = new URLSearchParams(search).get("display");
  return value === "wall" || value === "standard" ? value : null;
}

/** Marks the page, which the stylesheet keys the wall's type scale on. */
export function applyDisplayToDocument(mode: DisplayMode): void {
  if (mode === "wall") {
    document.documentElement.setAttribute("data-display", "wall");
  } else {
    document.documentElement.removeAttribute("data-display");
  }
}
