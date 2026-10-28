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

/** Where the family's photos live, where they may go, and how the last move went. */
export interface PhotoStorage {
  folder: string;
  /** The folders the server may store photos under. */
  roots: string[];
  /** A move is copying photos right now. */
  moving: boolean;
  /** Null when no move has finished since the server started. */
  lastMove: {
    to: string;
    moved: number;
    /** Set when the move failed; the photos stayed where they were. */
    error: string | null;
    finishedAt: string;
  } | null;
}

/** A parent moving the photos to another folder, with their own PIN. */
export interface PhotoFolderRequest {
  approverMemberId: string;
  pin: string;
  folder: string;
}
