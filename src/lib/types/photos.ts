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

/** One folder under the photo roots, for picking a folder by tapping through them. */
export interface PhotoFolderListing {
  /** The folder listed; null for the list of roots itself. */
  path: string | null;
  /** Where "up" leads: a folder, "" for the list of roots, or null at the top. */
  parent: string | null;
  /** The folders inside, sorted by name (at most 500). */
  folders: { name: string; path: string }[];
  /** How many photos sit directly in this folder. */
  photos: number;
  /** There were more folders than listed. */
  more: boolean;
}

/** The folder of existing photos (a NAS share, a phone backup) shown in the slideshow. */
export interface PhotoSource {
  /** Null when none is set. */
  folder: string | null;
  photoCount: number;
  /** HEIC pictures found but not shown: they need converting first. */
  skippedHeic: number;
  /** The folder is being read right now. */
  indexing: boolean;
  lastIndexedAt: string | null;
  /** Why the last reading failed, if it did. */
  error: string | null;
}

/** A parent choosing (or, with an empty folder, clearing) that folder, with their PIN. */
export interface PhotoSourceRequest {
  approverMemberId: string;
  pin: string;
  folder: string;
}

/** Folder photos join the slideshow under ids with this prefix. */
export const FOLDER_PHOTO_PREFIX = "folder:";
