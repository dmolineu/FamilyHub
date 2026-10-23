import { httpClient } from "@/api/client";
import type { BackupDocument, RestoreApiResponse } from "@/lib/types";

export const backupService = {
  /** The whole family's data as one document, ready to save as a file. */
  async exportBackup(): Promise<BackupDocument> {
    return httpClient.get<BackupDocument>("/backup");
  },

  /** Replaces the family's data with the document's contents. */
  async restoreBackup(document: BackupDocument): Promise<RestoreApiResponse> {
    return httpClient.post<RestoreApiResponse>("/backup/restore", document);
  },
};
