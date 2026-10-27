import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { avatarPackService } from "@/api/services/avatar-pack.service";
import type { AvatarPackDocument, AvatarPackSummary } from "@/lib/types";

export const avatarPackKeys = {
  all: ["avatar-packs"] as const,
  list: () => [...avatarPackKeys.all, "list"] as const,
  document: (id: string) => [...avatarPackKeys.all, "document", id] as const,
};

/** The family's character packs, without their pictures. */
export function useAvatarPacks() {
  return useQuery({
    queryKey: avatarPackKeys.list(),
    queryFn: avatarPackService.list,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Every listed pack's characters, for the avatar picker. A pack's document never
 * changes under the same id (a new import gets a new id), so each is fetched once.
 * Never persisted offline: packs can be several megabytes.
 */
export function useAvatarPackDocuments(summaries: AvatarPackSummary[]) {
  return useQueries({
    queries: summaries.map((summary) => ({
      queryKey: avatarPackKeys.document(summary.id),
      queryFn: () => avatarPackService.getDocument(summary.id),
      staleTime: Number.POSITIVE_INFINITY,
    })),
    combine: (results) => ({
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
      packs: results.flatMap((r, index) =>
        r.data ? [{ summary: summaries[index], document: r.data }] : [],
      ),
    }),
  });
}

export function useImportAvatarPack(callbacks?: {
  onSuccess?: (summary: AvatarPackSummary) => void;
  onError?: (error: ApiException) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (document: AvatarPackDocument) =>
      avatarPackService.importPack(document),
    onSuccess: async (summary) => {
      await queryClient.invalidateQueries({ queryKey: avatarPackKeys.list() });
      callbacks?.onSuccess?.(summary);
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

/** Fetches a pack file so the caller can offer it as a download. */
export function useExportAvatarPack(callbacks?: {
  onError?: (error: ApiException) => void;
}) {
  return useMutation({
    mutationFn: (id: string) => avatarPackService.getDocument(id),
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

/** Removes a pack for the whole family; members keep the character they chose. */
export function useDeleteAvatarPack(callbacks?: {
  onError?: (error: ApiException) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => avatarPackService.remove(id),
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: avatarPackKeys.document(id) });
      await queryClient.invalidateQueries({ queryKey: avatarPackKeys.list() });
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}
