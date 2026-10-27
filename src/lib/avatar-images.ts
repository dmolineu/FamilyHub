/**
 * Turning pictures into stored avatars, in the browser. The server keeps an avatar of
 * at most 64 KB, and the family payload carries every member's, so pictures are made
 * small here: characters at 128 px (enough for the wall's largest circle), photos at
 * 256 px. Canvas-based, so component tests replace this module.
 */

export const AVATAR_MAX_BYTES = 64 * 1024;
const CHARACTER_SIZE = 128;
const PHOTO_SIZE = 256;

/** Loads a picture from a data URL or object URL. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The picture could not be opened"));
    image.src = src;
  });
}

/** Bytes held by a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function draw(
  image: CanvasImageSource,
  rect: { sx: number; sy: number; size: number },
  size: number,
  type: "image/png" | "image/jpeg",
  quality?: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize pictures");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    rect.sx,
    rect.sy,
    rect.size,
    rect.size,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL(type, quality);
}

/** The centred square of a picture, which is how characters are framed. */
function centreSquare(width: number, height: number) {
  const size = Math.min(width, height);
  return { sx: (width - size) / 2, sy: (height - size) / 2, size };
}

/**
 * A character's picture made into an avatar. PNG and WebP keep their transparency (as
 * PNG, since not every browser can write WebP); JPEGs stay JPEG. Shrinks further in
 * the rare case the result is still over 64 KB.
 */
export async function characterAvatar(image: string): Promise<string> {
  const picture = await loadImage(image);
  const rect = centreSquare(picture.naturalWidth, picture.naturalHeight);
  const type = image.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";
  for (const size of [CHARACTER_SIZE, 96, 64]) {
    const result = draw(picture, rect, size, type, 0.9);
    if (dataUrlBytes(result) <= AVATAR_MAX_BYTES) return result;
  }
  throw new Error("That character's picture is too detailed to use");
}

/** The cropped part of a photo made into a 256 px JPEG avatar of at most 64 KB. */
export function photoAvatar(
  image: HTMLImageElement,
  rect: { sx: number; sy: number; size: number },
): string {
  for (const [size, quality] of [
    [PHOTO_SIZE, 0.85],
    [PHOTO_SIZE, 0.7],
    [192, 0.7],
    [128, 0.7],
  ] as const) {
    const result = draw(image, rect, size, "image/jpeg", quality);
    if (dataUrlBytes(result) <= AVATAR_MAX_BYTES) return result;
  }
  throw new Error("That photo could not be made small enough");
}
