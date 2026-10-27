/**
 * Member avatars: what a stored avatar value means, the pictures drawn into the app,
 * and the maths behind cropping a photo to the avatar circle.
 *
 * A stored avatar is one of (the server checks the same rules):
 * - nothing, so the member shows their initial on their colour;
 * - `builtin:<key>`, one of {@link BUILT_IN_AVATARS};
 * - a PNG, JPEG or WebP data URL (an uploaded photo or a chosen character, copied
 *   onto the member so it survives its pack being deleted);
 * - an https link, the only form older versions stored.
 */

/** Pictures drawn for the app (no third-party art), in picker order. */
export const BUILT_IN_AVATARS: { key: string; name: string }[] = [
  { key: "fox", name: "Fox" },
  { key: "cat", name: "Cat" },
  { key: "bear", name: "Bear" },
  { key: "owl", name: "Owl" },
  { key: "rabbit", name: "Rabbit" },
  { key: "panda", name: "Panda" },
  { key: "frog", name: "Frog" },
  { key: "penguin", name: "Penguin" },
  { key: "star", name: "Star" },
  { key: "rocket", name: "Rocket" },
  { key: "heart", name: "Heart" },
  { key: "sun", name: "Sun" },
];

export const BUILT_IN_PREFIX = "builtin:";

const builtInKeys = new Set(BUILT_IN_AVATARS.map((a) => a.key));

export type ParsedAvatar =
  | { kind: "initials" }
  | { kind: "builtin"; key: string }
  | { kind: "image"; src: string };

/**
 * What to draw for a stored avatar. Anything unrecognised, including a built-in key
 * from a newer version of the app, falls back to the initial rather than a broken image.
 */
export function parseAvatar(value: string | null | undefined): ParsedAvatar {
  if (!value) return { kind: "initials" };
  if (value.startsWith(BUILT_IN_PREFIX)) {
    const key = value.slice(BUILT_IN_PREFIX.length);
    return builtInKeys.has(key)
      ? { kind: "builtin", key }
      : { kind: "initials" };
  }
  if (/^data:image\/(png|jpeg|webp);base64,/.test(value)) {
    return { kind: "image", src: value };
  }
  if (value.startsWith("https://")) return { kind: "image", src: value };
  return { kind: "initials" };
}

// ---------------------------------------------------------------------------
// Cropping a photo into the avatar circle
// ---------------------------------------------------------------------------
//
// The photo is drawn at scale `s` with its top-left corner at `offset` inside a square
// viewport of `V` CSS pixels (the circle's bounding box). At zoom 1 the photo's short
// side exactly fills the circle; zooming in enlarges it around the circle's centre.

/** Where the photo's top-left corner sits inside the viewport, in viewport pixels. */
export interface Offset {
  x: number;
  y: number;
}

/** The scale at which the photo's short side fills the viewport, times the zoom. */
export function coverScale(
  width: number,
  height: number,
  viewport: number,
  zoom: number,
): number {
  return (viewport / Math.min(width, height)) * zoom;
}

/** The offset that centres the photo at the given zoom. */
export function initialOffset(
  width: number,
  height: number,
  viewport: number,
  zoom: number,
): Offset {
  const s = coverScale(width, height, viewport, zoom);
  return { x: (viewport - width * s) / 2, y: (viewport - height * s) / 2 };
}

/** Keeps the photo covering the whole viewport, so the circle never shows a gap. */
export function clampOffset(
  offset: Offset,
  width: number,
  height: number,
  viewport: number,
  scale: number,
): Offset {
  const minX = viewport - width * scale;
  const minY = viewport - height * scale;
  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y)),
  };
}

/** The offset after changing zoom, keeping the point under the circle's centre still. */
export function zoomAround(
  offset: Offset,
  width: number,
  height: number,
  viewport: number,
  fromZoom: number,
  toZoom: number,
): Offset {
  const from = coverScale(width, height, viewport, fromZoom);
  const to = coverScale(width, height, viewport, toZoom);
  const centreX = (viewport / 2 - offset.x) / from;
  const centreY = (viewport / 2 - offset.y) / from;
  return clampOffset(
    { x: viewport / 2 - centreX * to, y: viewport / 2 - centreY * to },
    width,
    height,
    viewport,
    to,
  );
}

/** The square of the original photo that the viewport shows, in photo pixels. */
export function sourceRect(
  offset: Offset,
  scale: number,
  viewport: number,
): { sx: number; sy: number; size: number } {
  // `0 - x` rather than `-x`, so an edge-aligned photo gives 0 and not -0.
  return {
    sx: (0 - offset.x) / scale,
    sy: (0 - offset.y) / scale,
    size: viewport / scale,
  };
}
