import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ApiException } from "@/api/client";
import { photosService } from "@/api/services";
import type { ApiResponse, Photo, PhotoVariant } from "@/lib/types";

export const photoKeys = {
  all: ["photos"] as const,
  list: () => [...photoKeys.all, "list"] as const,
};

/**
 * The family's photos. Refetched every 10 minutes so a wall left on the
 * screensaver picks up photos added from a phone.
 */
export function usePhotos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: photoKeys.list(),
    queryFn: () => photosService.list(),
    select: (response: ApiResponse<Photo[]>) => response.data,
    staleTime: 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/** Uploads one prepared photo and refreshes the list. */
export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<Photo>, ApiException, Blob>({
    mutationFn: (file) => photosService.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.list() });
    },
  });
}

/** Deletes a photo and drops it from the cached list at once. */
export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiException, string>({
    mutationFn: (id) => photosService.remove(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<ApiResponse<Photo[]>>(
        photoKeys.list(),
        (current) =>
          current
            ? { ...current, data: current.data.filter((p) => p.id !== id) }
            : current,
      );
      queryClient.invalidateQueries({ queryKey: photoKeys.list() });
    },
  });
}

/**
 * An object URL for one photo, revoked when the photo changes or the component
 * goes away, so a slideshow that runs for days does not pile up memory. Null
 * until loaded or when the photo cannot be fetched.
 */
export function usePhotoUrl(
  id: string | null | undefined,
  variant: PhotoVariant,
): string | null {
  // Remember which photo the URL belongs to, so a stale (already revoked) URL is
  // never handed back for the next photo while that one is still loading.
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(
    null,
  );
  const key = id ? `${id}/${variant}` : null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let created: string | null = null;
    photosService.image(id, variant).then(
      (blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setLoaded({ key: `${id}/${variant}`, url: created });
      },
      () => {
        // A missing or failed photo just stays blank.
      },
    );
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id, variant]);

  return loaded && loaded.key === key ? loaded.url : null;
}
