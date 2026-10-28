import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  Photo,
  PhotoFolderRequest,
  PhotoStorage,
  PhotoVariant,
} from "@/lib/types";

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

  async remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/photos/${id}`);
  },

  /**
   * The image bytes. An <img> cannot send the bearer token, so images are
   * fetched here and shown through object URLs.
   */
  async image(id: string, variant: PhotoVariant): Promise<Blob> {
    return httpClient.getBlob(`/photos/${id}/${variant}`);
  },
};
