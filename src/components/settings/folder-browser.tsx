import { ChevronRight, CornerLeftUp, Folder } from "lucide-react";
import { useState } from "react";
import { usePhotoFolders } from "@/api";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";

interface FolderBrowserProps {
  /** The folder being chosen; "" starts at the folders mounted for photos. */
  value: string;
  onChange: (folder: string) => void;
}

/** Typing waits this long before the server is asked, so half a path is never listed. */
const TYPING_PAUSE_MS = 300;

function photosLine(count: number): string {
  if (count === 0) return "No photos directly in this folder";
  return `${count.toLocaleString()} photo${count === 1 ? "" : "s"} in this folder`;
}

/**
 * Tap through the folders the server may use for photos instead of typing a path:
 * each tap opens a folder and fills in the path, and Up goes back. It lists the
 * folder in the path field, so typing a path works too; what is tapped is listed
 * at once, what is typed once typing pauses.
 */
export function FolderBrowser({ value, onChange }: FolderBrowserProps) {
  const typed = value.trim();
  const [tapped, setTapped] = useState<string | null>(null);
  const settled = useDebounce(typed, TYPING_PAUSE_MS);
  const listing = usePhotoFolders(tapped === typed ? typed : settled);

  const open = (folder: string) => {
    setTapped(folder);
    onChange(folder);
  };

  const data = listing.data;
  return (
    <nav
      aria-label="Folders"
      className="overflow-hidden rounded-lg border border-border"
    >
      {listing.isError ? (
        <div className="space-y-2 p-3">
          <p role="alert" className="text-sm text-destructive">
            {listing.error.message}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => open("")}
          >
            Start from the top
          </Button>
        </div>
      ) : !data ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          Looking at the folders…
        </p>
      ) : (
        <>
          {data.parent !== null && (
            <button
              type="button"
              onClick={() => open(data.parent ?? "")}
              className="flex min-h-11 w-full items-center gap-2 border-b border-border px-3 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <CornerLeftUp className="h-4 w-4 shrink-0" aria-hidden="true" />
              Up
              <span className="sr-only">
                {data.parent ? ` to ${data.parent}` : " to the start"}
              </span>
            </button>
          )}
          {data.folders.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto">
              {data.folders.map((folder) => (
                <li key={folder.path}>
                  <button
                    type="button"
                    onClick={() => open(folder.path)}
                    className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm hover:bg-muted"
                  >
                    <Folder
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1 break-all">{folder.name}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No folders inside.
            </p>
          )}
          {data.more && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Showing the first {data.folders.length} folders; type the rest of
              the path to go further.
            </p>
          )}
          {data.path !== null && (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {photosLine(data.photos)}
            </p>
          )}
        </>
      )}
    </nav>
  );
}
