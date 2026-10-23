import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { themePackService } from "@/api/services/theme-pack.service";
import { DEFAULT_THEME_SELECTION } from "@/lib/themes";
import type { ThemePackDocument, ThemePackSummary } from "@/lib/types";
import { useThemeStore } from "@/stores/theme-store";

export const themePackKeys = {
  all: ["theme-packs"] as const,
  list: () => [...themePackKeys.all, "list"] as const,
};

/** The family's imported looks, for the Appearance picker. */
export function useThemePacks() {
  return useQuery({
    queryKey: themePackKeys.list(),
    queryFn: themePackService.list,
    staleTime: 5 * 60 * 1000,
  });
}

export function useImportThemePack(callbacks?: {
  onSuccess?: (summary: ThemePackSummary) => void;
  onError?: (error: ApiException) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (document: ThemePackDocument) =>
      themePackService.importPack(document),
    onSuccess: async (summary) => {
      await queryClient.invalidateQueries({ queryKey: themePackKeys.all });
      callbacks?.onSuccess?.(summary);
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

/**
 * Picks a pack for this device: fetches its document, caches it locally so it
 * paints offline and before load, and switches the look.
 */
export function useSelectThemePack(callbacks?: {
  onError?: (error: ApiException) => void;
}) {
  const setAppliedPack = useThemeStore((s) => s.setAppliedPack);
  const setSelection = useThemeStore((s) => s.setSelection);
  return useMutation({
    mutationFn: async (summary: ThemePackSummary) => {
      const document = await themePackService.getDocument(summary.id);
      setAppliedPack({
        id: summary.id,
        name: document.name,
        dark: document.dark,
        tokens: document.tokens,
        images: document.images ?? {},
        slots: document.slots,
      });
      setSelection({ kind: "pack", id: summary.id });
      return document;
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

/** Fetches the pack file so the caller can offer it as a download. */
export function useExportThemePack(callbacks?: {
  onError?: (error: ApiException) => void;
}) {
  return useMutation({
    mutationFn: (id: string) => themePackService.getDocument(id),
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

/** Removes a pack for the whole family; a device showing it falls back to Default. */
export function useDeleteThemePack(callbacks?: {
  onError?: (error: ApiException) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => themePackService.remove(id),
    onSuccess: async (_result, id) => {
      const state = useThemeStore.getState();
      if (state.selection.kind === "pack" && state.selection.id === id) {
        state.setSelection(DEFAULT_THEME_SELECTION);
        state.setAppliedPack(null);
      }
      await queryClient.invalidateQueries({ queryKey: themePackKeys.all });
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}
