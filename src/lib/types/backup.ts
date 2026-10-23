import type { ApiResponse } from "./api-response";

/**
 * The file produced by GET /backup. Only the envelope is typed; the modules inside are
 * the server's business and go back to POST /backup/restore untouched.
 */
export interface BackupDocument {
  version: number;
  exportedAt: string;
  family: { name: string; [key: string]: unknown };
  [module: string]: unknown;
}

/** What POST /backup/restore reports back: rows restored per module. */
export interface RestoreSummary {
  members: number;
  chores: number;
  lists: number;
  recipes: number;
  meals: number;
  events: number;
}

export type RestoreApiResponse = ApiResponse<RestoreSummary>;
