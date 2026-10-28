import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  FolderPhotoPage,
  Photo,
  PhotoFolderListing,
  PhotoFolderRequest,
  PhotoSource,
  PhotoSourceRequest,
  PhotoStorage,
  PhotoVariant,
} from "@/lib/types";
import { FOLDER_PHOTO_PREFIX } from "@/lib/types";

export const photosService = {
  /** The family's photos, newest first (details only). */
  async list(): Promise<ApiResponse<Photo[]>> {
    return httpClient.get<ApiResponse<Photo[]>>("/photos");
  },

  /** Uploads one prepared JPEG or PNG. */
  async upload(file: Blob): Promise<ApiResponse<Photo>> {
    return httpClient.postBinary<ApiResponse<Photo>>("/photos", file);
  },

  /** Where the photos live and where they may go. */
  async storage(): Promise<ApiResponse<PhotoStorage>> {
    return httpClient.get<ApiResponse<PhotoStorage>>("/photos/storage");
  },

  /** Starts moving the photos to another folder; the move runs on the server. */
  async moveStorage(
    request: PhotoFolderRequest,
  ): Promise<ApiResponse<PhotoStorage>> {
    return httpClient.put<ApiResponse<PhotoStorage>>(
      "/photos/storage",
      request,
    );
  },

  /** The folder of existing photos shown in the slideshow. */
  async source(): Promise<ApiResponse<PhotoSource>> {
    return httpClient.get<ApiResponse<PhotoSource>>("/photos/source");
  },

  /** Chooses (or, empty, clears) that folder; the server reads it in the background. */
  async chooseSource(
    request: PhotoSourceRequest,
  ): Promise<ApiResponse<PhotoSource>> {
    return httpClient.put<ApiResponse<PhotoSource>>("/photos/source", request);
  },

  /** The folders inside a folder under the photo roots; the roots themselves for "". */
  async folders(path: string): Promise<ApiResponse<PhotoFolderListing>> {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    return httpClient.get<ApiResponse<PhotoFolderListing>>(
      `/photos/folders${query}`,
    );
  },

  /** A random handful of the folder's pictures for one showing of the slideshow. */
  async folderSample(count: number): Promise<ApiResponse<string[]>> {
    return httpClient.get<ApiResponse<string[]>>(
      `/photos/folder?sample=${count}`,
    );
  },

  /** A page of the folder's photos, newest first, for the Photos screen. */
  async folderPhotos(
    page: number,
    size: number,
  ): Promise<ApiResponse<FolderPhotoPage>> {
    return httpClient.get<ApiResponse<FolderPhotoPage>>(
      `/photos/folder/list?page=${page}&size=${size}`,
    );
  },

  async remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/photos/${id}`);
  },

  /**
   * The image bytes. An <img> cannot send the bearer token, so images are
   * fetched here and shown through object URLs.
   */
  async image(id: string, variant: PhotoVariant): Promise<Blob> {
    if (id.startsWith(FOLDER_PHOTO_PREFIX)) {
      return httpClient.getBlob(
        `/photos/folder/${id.slice(FOLDER_PHOTO_PREFIX.length)}/${variant}`,
      );
    }
    return httpClient.getBlob(`/photos/${id}/${variant}`);
  },
};
