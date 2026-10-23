import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { backupService } from "@/api/services/backup.service";
import type { BackupDocument, RestoreApiResponse } from "@/lib/types";

/** Fetches the backup document; the caller turns it into a download. */
export function useExportBackup(callbacks?: {
  onSuccess?: (document: BackupDocument) => void;
  onError?: (error: ApiException) => void;
}) {
  return useMutation({
    mutationFn: () => backupService.exportBackup(),
    onSuccess: (document) => callbacks?.onSuccess?.(document),
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

/** Restores a document and then drops every cached query: all data changed. */
export function useRestoreBackup(callbacks?: {
  onSuccess?: (response: RestoreApiResponse) => void;
  onError?: (error: ApiException) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (document: BackupDocument) =>
      backupService.restoreBackup(document),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries();
      callbacks?.onSuccess?.(response);
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}
