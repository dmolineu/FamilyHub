/**
 * Photos are shrunk in the browser before upload: a phone's 12-megapixel JPEG
 * becomes a ~400 KB 1920 px one, which is all a wall display needs. Redrawing it
 * through a canvas also applies the camera's rotation (createImageBitmap honours
 * EXIF orientation) and drops the metadata, including where the photo was taken.
 */
export const MAX_UPLOAD_EDGE = 1920;
const JPEG_QUALITY = 0.85;

/** The size that fits within `max` on the long edge; never larger than the original. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Turns a chosen file into an upload-ready JPEG.
 *
 * @throws Error with a readable message when this browser cannot open the file
 *   (for example HEIC outside Safari)
 */
export async function preparePhotoForUpload(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This browser can't open that kind of photo. Try a JPEG or PNG.",
    );
  }
  try {
    const { width, height } = fitWithin(
      bitmap.width,
      bitmap.height,
      MAX_UPLOAD_EDGE,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't resize photos.");
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("The photo could not be saved.")),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
