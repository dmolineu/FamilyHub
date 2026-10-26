/** A screensaver photo's details; the image itself is fetched separately. */
export interface Photo {
  id: string;
  contentType: "image/jpeg" | "image/png";
  width: number;
  height: number;
  sizeBytes: number;
  /** An instant (ISO 8601). */
  createdAt: string;
}

/** Which rendition of a photo to fetch. */
export type PhotoVariant = "content" | "thumbnail";
