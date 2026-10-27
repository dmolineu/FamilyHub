import { httpClient } from "@/api/client";
import type {
  AvatarPackDocument,
  AvatarPackImportResponse,
  AvatarPackListResponse,
  AvatarPackSummary,
} from "@/lib/types";

export const avatarPackService = {
  async list(): Promise<AvatarPackSummary[]> {
    const response =
      await httpClient.get<AvatarPackListResponse>("/avatar-packs");
    return response.data;
  },

  /** The pack file exactly as it was imported, pictures included. */
  async getDocument(id: string): Promise<AvatarPackDocument> {
    return httpClient.get<AvatarPackDocument>(`/avatar-packs/${id}`);
  },

  async importPack(document: AvatarPackDocument): Promise<AvatarPackSummary> {
    const response = await httpClient.post<AvatarPackImportResponse>(
      "/avatar-packs",
      document,
    );
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete<void>(`/avatar-packs/${id}`);
  },
};

/** "Star Wars" → "star-wars.familyavatars.json"; the server names downloads the same way. */
export function avatarPackFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "avatars"}.familyavatars.json`;
}
