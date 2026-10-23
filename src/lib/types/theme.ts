import type { ApiResponse } from "./api-response";

/**
 * A theme pack file: one self-contained look a family imports. Tokens become
 * CSS custom properties on every device that picks it, images are data URLs
 * referenced by the slots. Mirrors the server's ThemePackDocumentValidator.
 */
export interface ThemePackDocument {
  version: 1;
  name: string;
  dark: boolean;
  tokens: Record<string, string>;
  images?: Record<string, string>;
  slots?: ThemePackSlots;
}

/** Which image (by key in `images`) fills which spot in the app. */
export interface ThemePackSlots {
  /** Shown beside the family name in the header. */
  headerLogo?: string;
  /** A wide picture above the Home dashboard. */
  homeBanner?: string;
  /** Small decorative figures in the header, up to six. */
  mascots?: string[];
  /** Image to shrink into the picker's thumbnail; defaults to "background". */
  thumbnail?: string;
}

/**
 * Enough to draw a pack's card without downloading it: five card colours (null
 * when the pack does not set that token) and a small thumbnail of its backdrop.
 */
export interface ThemePackPreview {
  background: string | null;
  card: string | null;
  primary: string | null;
  foreground: string | null;
  accent: string | null;
  thumbnail: string | null;
}

export interface ThemePackSummary {
  id: string;
  name: string;
  dark: boolean;
  sizeBytes: number;
  createdAt: string;
  preview?: ThemePackPreview | null;
}

export type ThemePackListResponse = ApiResponse<ThemePackSummary[]>;
export type ThemePackImportResponse = ApiResponse<ThemePackSummary>;
