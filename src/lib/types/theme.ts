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
  /** Small decorative figures in the header, up to three. */
  mascots?: string[];
}

export interface ThemePackSummary {
  id: string;
  name: string;
  dark: boolean;
  sizeBytes: number;
  createdAt: string;
}

export type ThemePackListResponse = ApiResponse<ThemePackSummary[]>;
export type ThemePackImportResponse = ApiResponse<ThemePackSummary>;
