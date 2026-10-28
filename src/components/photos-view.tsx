import { ImagePlus, Play, Trash2 } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import {
  useDeletePhoto,
  useFolderPhotos,
  usePhotoSource,
  usePhotos,
  usePhotoUrl,
  useUploadPhoto,
} from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { preparePhotoForUpload } from "@/lib/prepare-photo";
import {
  FOLDER_PHOTO_PREFIX,
  type FolderPhotoItem,
  type Photo,
} from "@/lib/types";
import { useScreensaverStore } from "@/stores";

function photosLabel(count: number): string {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

const ADDED_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function PhotoTile({
  photo,
  position,
  total,
  onDelete,
}: {
  photo: Photo;
  position: number;
  total: number;
  onDelete: () => void;
}) {
  const url = usePhotoUrl(photo.id, "thumbnail");
  const added = ADDED_FORMAT.format(new Date(photo.createdAt));
  return (
    <li className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
      {url && (
        <img
          src={url}
          alt={`Added ${added}, ${position} of ${total}`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        aria-label="Delete photo"
        onClick={onDelete}
        className="absolute top-2 right-2 bg-background/85 shadow-sm backdrop-blur-sm"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

/** A photo of the family's folder: shown, never deleted from here (the share is only read). */
function FolderPhotoTile({
  photo,
  position,
  total,
}: {
  photo: FolderPhotoItem;
  position: number;
  total: number;
}) {
  const url = usePhotoUrl(`${FOLDER_PHOTO_PREFIX}${photo.id}`, "thumbnail");
  return (
    <li className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
      {url && (
        <img
          src={url}
          alt={`${photo.name}, ${position} of ${total}`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </li>
  );
}

/**
 * The screensaver's photo library. Photos are shrunk in the browser before
 * upload (see prepare-photo.ts) and shown here as thumbnails; the slideshow
 * itself runs on its own when a device sits idle, or from "Start slideshow".
 * A folder of photos the family already has (Family Settings → Photos from a
 * folder, the NAS share) is shown below them a page at a time, read-only.
 */
export function PhotosView() {
  const photos = usePhotos();
  const source = usePhotoSource().data;
  const folderPhotos = useFolderPhotos(source);
  const folderItems =
    folderPhotos.data?.pages.flatMap((page) => page.data.items) ?? [];
  const folderTotal = source?.folder
    ? (folderPhotos.data?.pages[0]?.data.total ?? source.photoCount)
    : 0;
  const folderInUse = Boolean(
    source?.folder && (source.indexing || folderTotal > 0),
  );
  const upload = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const startScreensaver = useScreensaverStore((s) => s.start);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const items = photos.data ?? [];

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Allow choosing the same files again later.
    event.target.value = "";
    if (files.length === 0) return;
    setResult(null);
    setFailures([]);
    let added = 0;
    const problems: string[] = [];
    // One at a time: a Pi and a phone on Wi-Fi both prefer a steady trickle.
    for (const [i, file] of files.entries()) {
      setProgress(`Adding ${i + 1} of ${files.length}…`);
      try {
        const prepared = await preparePhotoForUpload(file);
        await upload.mutateAsync(prepared);
        added++;
      } catch (error) {
        problems.push(
          `${file.name}: ${error instanceof Error ? error.message : "It could not be added."}`,
        );
      }
    }
    setProgress(null);
    setFailures(problems);
    setResult(`Added ${photosLabel(added)}.`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] leading-8 font-semibold text-foreground">
              Photos
            </h1>
            <p className="text-sm text-muted-foreground">
              {photosLabel(items.length + folderTotal)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={startScreensaver}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Start slideshow
            </Button>
            <label
              htmlFor="photo-upload"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-within:ring-2 focus-within:ring-ring"
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              Add photos
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Add photos"
                disabled={progress !== null}
                onChange={addFiles}
              />
            </label>
          </div>
        </div>

        {progress && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {progress}
          </p>
        )}
        {result && (
          <p
            role="status"
            className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground"
          >
            {result}
          </p>
        )}
        {failures.length > 0 && (
          <div
            role="alert"
            className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {failures.map((failure) => (
              <p key={failure}>{failure}</p>
            ))}
          </div>
        )}

        {photos.isLoading && (
          <p className="text-sm text-muted-foreground">Loading photos…</p>
        )}
        {photos.isError && (
          <p className="text-sm text-destructive">
            Photos could not be loaded. Try again in a moment.
          </p>
        )}
        {source?.folder && source.indexing && (
          <p className="text-sm text-muted-foreground">
            Reading the photos in {source.folder}…
          </p>
        )}
        {!photos.isLoading &&
          !photos.isError &&
          items.length === 0 &&
          !folderInUse && (
            <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                No photos yet
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Add photos to show them on the screensaver. They are shrunk to
                screen size on the way up, and where they were taken is left
                out.
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                To show a folder of photos you already have, such as the NAS
                share, a parent chooses it in Family Settings → Photos from a
                folder.
              </p>
            </div>
          )}

        {items.length > 0 && (
          <section className="space-y-3">
            {folderInUse && (
              <h2 className="text-lg font-semibold text-foreground">
                Added here
              </h2>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((photo, i) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  position={i + 1}
                  total={items.length}
                  onDelete={() => setConfirmingId(photo.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {source?.folder && folderItems.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2
                id="folder-photos-heading"
                className="text-lg font-semibold break-all text-foreground"
              >
                From {source.folder}
              </h2>
              <p className="text-sm text-muted-foreground">
                In the slideshow too. They stay on the share: add or remove them
                there.
              </p>
            </div>
            <ul
              aria-labelledby="folder-photos-heading"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              {folderItems.map((photo, i) => (
                <FolderPhotoTile
                  key={photo.id}
                  photo={photo}
                  position={i + 1}
                  total={folderTotal}
                />
              ))}
            </ul>
            {folderPhotos.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={folderPhotos.isFetchingNextPage}
                  onClick={() => void folderPhotos.fetchNextPage()}
                >
                  Show more photos
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog
        open={confirmingId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmingId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this photo?</DialogTitle>
            <DialogDescription>
              It leaves the screensaver on every screen. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setConfirmingId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={deletePhoto.isPending}
              onClick={() => {
                if (confirmingId) deletePhoto.mutate(confirmingId);
                setConfirmingId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
