import { httpClient } from "@/api/client";
import type {
  ThemePackDocument,
  ThemePackImportResponse,
  ThemePackListResponse,
  ThemePackSummary,
} from "@/lib/types";

export const themePackService = {
  async list(): Promise<ThemePackSummary[]> {
    const response =
      await httpClient.get<ThemePackListResponse>("/theme-packs");
    return response.data;
  },

  /** The pack file exactly as it was imported. */
  async getDocument(id: string): Promise<ThemePackDocument> {
    return httpClient.get<ThemePackDocument>(`/theme-packs/${id}`);
  },

  async importPack(document: ThemePackDocument): Promise<ThemePackSummary> {
    const response = await httpClient.post<ThemePackImportResponse>(
      "/theme-packs",
      document,
    );
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete<void>(`/theme-packs/${id}`);
  },
};

/** "San Diego Padres" → "san-diego-padres"; the server names downloads the same way. */
export function themePackFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "theme"}.familytheme.json`;
}
