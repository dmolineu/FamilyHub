import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ApiException } from "@/api/client";
import { photosService } from "@/api/services";
import type {
  ApiResponse,
  Photo,
  PhotoFolderListing,
  PhotoFolderRequest,
  PhotoSource,
  PhotoSourceRequest,
  PhotoStorage,
  PhotoVariant,
} from "@/lib/types";
import { FOLDER_PHOTO_PREFIX } from "@/lib/types";

export const photoKeys = {
  all: ["photos"] as const,
  list: () => [...photoKeys.all, "list"] as const,
  storage: () => [...photoKeys.all, "storage"] as const,
  source: () => [...photoKeys.all, "source"] as const,
  folderSample: () => [...photoKeys.all, "folder-sample"] as const,
  folders: (path: string) => [...photoKeys.all, "folders", path] as const,
};

/**
 * The folders inside a folder under the photo roots ("" for the roots), for picking
 * a folder by tapping. The last listing stays on screen while the next one loads.
 */
export function usePhotoFolders(path: string) {
  return useQuery({
    queryKey: photoKeys.folders(path),
    queryFn: () => photosService.folders(path),
    select: (response: ApiResponse<PhotoFolderListing>) => response.data,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Where the photos live; looks again every second and a half while they move. */
export function usePhotoStorage(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: photoKeys.storage(),
    queryFn: () => photosService.storage(),
    select: (response: ApiResponse<PhotoStorage>) => response.data,
    enabled: options?.enabled ?? true,
    refetchInterval: (query) => (query.state.data?.data.moving ? 1500 : false),
  });
}

/** The folder of existing photos; looks again every two seconds while it is being read. */
export function usePhotoSource(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: photoKeys.source(),
    queryFn: () => photosService.source(),
    select: (response: ApiResponse<PhotoSource>) => response.data,
    enabled: options?.enabled ?? true,
    refetchInterval: (query) =>
      query.state.data?.data.indexing ? 2000 : false,
  });
}

/** Chooses or clears that folder (a parent's PIN in the request). */
export function useChoosePhotoSource() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<PhotoSource>,
    ApiException,
    PhotoSourceRequest
  >({
    mutationFn: (request) => photosService.chooseSource(request),
    onSuccess: (response) => {
      queryClient.setQueryData(photoKeys.source(), response);
      queryClient.invalidateQueries({ queryKey: photoKeys.folderSample() });
    },
  });
}

/**
 * A random handful of the folder's pictures for the slideshow, as `folder:` ids. A big
 * share holds thousands; a few hundred per showing keeps the list small.
 */
export function useFolderPhotoSample(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: photoKeys.folderSample(),
    queryFn: () => photosService.folderSample(300),
    select: (response: ApiResponse<string[]>) =>
      response.data.map((id) => `${FOLDER_PHOTO_PREFIX}${id}`),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 60 * 1000,
  });
}

/** Starts moving the photos (a parent's PIN in the request). */
export function useMovePhotoStorage() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<PhotoStorage>,
    ApiException,
    PhotoFolderRequest
  >({
    mutationFn: (request) => photosService.moveStorage(request),
    onSuccess: (response) => {
      queryClient.setQueryData(photoKeys.storage(), response);
    },
  });
}

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
