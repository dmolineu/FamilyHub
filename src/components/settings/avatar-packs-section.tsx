import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  avatarPackFileName,
  useAvatarPacks,
  useDeleteAvatarPack,
  useExportAvatarPack,
  useImportAvatarPack,
} from "@/api";
import { Button } from "@/components/ui/button";
import type { AvatarPackDocument, AvatarPackSummary } from "@/lib/types";

/**
 * Family Settings: the character packs everyone picks avatars from. A pack is a
 * `.familyavatars.json` file (built outside the app, never part of its code); import
 * it once and every device offers its characters.
 */
export function AvatarPacksSection() {
  const packs = useAvatarPacks();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importPack = useImportAvatarPack({
    onSuccess: (summary) =>
      setStatus(
        `Imported ${summary.name} (${summary.characterCount} characters).`,
      ),
    onError: (e) => setError(e.message || "The pack could not be imported."),
  });
  const exportPack = useExportAvatarPack({
    onError: (e) => setError(e.message || "The pack could not be downloaded."),
  });
  const deletePack = useDeleteAvatarPack({
    onError: (e) => setError(e.message || "The pack could not be deleted."),
  });

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setStatus(null);
    // FileReader rather than file.text(): the latter is missing in older WebViews.
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AvatarPackDocument;
        if (
          !parsed ||
          parsed.version !== 1 ||
          typeof parsed.name !== "string" ||
          !Array.isArray(parsed.characters)
        ) {
          throw new Error("shape");
        }
        importPack.mutate(parsed);
      } catch {
        setError("That is not a character pack file.");
      }
    };
    reader.onerror = () => setError("That file could not be read.");
    reader.readAsText(file);
  };

  const download = (summary: AvatarPackSummary) => {
    setError(null);
    exportPack.mutate(summary.id, {
      onSuccess: (document) => {
        const blob = new Blob([JSON.stringify(document, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = avatarPackFileName(summary.name);
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  const list = packs.data ?? [];

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Character packs
        </h3>
        <p className="text-sm text-muted-foreground">
          Sets of characters anyone can pick as their picture, imported from a
          .familyavatars.json file.
        </p>
      </div>

      {packs.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No character packs yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((pack) => (
            <li
              key={pack.id}
              className="rounded-lg border border-border p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pack.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pack.characterCount} characters · {pack.groups.join(", ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Download ${pack.name}`}
                  onClick={() => download(pack)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Delete ${pack.name}`}
                  onClick={() => setConfirmingId(pack.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {confirmingId === pack.id && (
                <div className="rounded-md bg-muted p-3 space-y-2">
                  <p className="text-sm">
                    Delete {pack.name}? Members who chose one of its characters
                    keep that picture.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1"
                      onClick={() => setConfirmingId(null)}
                    >
                      Keep it
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11 flex-1"
                      disabled={deletePack.isPending}
                      onClick={() =>
                        deletePack.mutate(pack.id, {
                          onSuccess: () => setConfirmingId(null),
                        })
                      }
                    >
                      Delete pack
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2"
        disabled={importPack.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {importPack.isPending ? "Importing…" : "Import a character pack"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={onFile}
        className="hidden"
        aria-label="Import a character pack file"
      />
    </section>
  );
}
