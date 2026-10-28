import { FolderInput, Loader2 } from "lucide-react";
import { useState } from "react";
import { useMovePhotoStorage, usePhotoStorage } from "@/api";
import { ParentPinPad } from "@/components/chores/parent-pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderBrowser } from "./folder-browser";

type Step = "idle" | "folder" | "pin";

/**
 * Family Settings: where the screensaver photos are kept, as files in a folder (a NAS
 * share, usually), and moving them to another folder with a parent's PIN. The server
 * copies every photo before switching, so a failed move leaves them where they were.
 */
export function PhotoStorageSection() {
  const storage = usePhotoStorage();
  const move = useMovePhotoStorage();
  const [step, setStep] = useState<Step>("idle");
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [startedMove, setStartedMove] = useState(false);
  const data = storage.data;

  const lastMove = data?.lastMove ?? null;
  // Once a move this screen started has finished, say how it went.
  const finished =
    startedMove && data && !data.moving && lastMove && !lastMove.error
      ? `Moved ${lastMove.moved} photo${lastMove.moved === 1 ? "" : "s"} to ${lastMove.to}.`
      : null;

  const submit = async (approverMemberId: string, pin: string) => {
    await move.mutateAsync({ approverMemberId, pin, folder: folder.trim() });
    setStartedMove(true);
    setStatus(null);
    setStep("idle");
    setFolder("");
  };

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Photo storage
        </h3>
        <p className="text-sm text-muted-foreground">
          Screensaver photos are kept as files in this folder, so back up that
          folder (a NAS share's own backup does it).
        </p>
      </div>

      {data && (
        <div className="space-y-1 rounded-lg bg-muted px-3 py-2">
          <p className="break-all font-mono text-sm text-foreground">
            {data.folder}
          </p>
          <p className="text-xs text-muted-foreground">
            They can go in a folder under {data.roots.join(" or ")}.
          </p>
        </div>
      )}

      {data?.moving && (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Moving the photos to their new folder…
        </p>
      )}
      {lastMove?.error && !data?.moving && (
        <p role="alert" className="text-sm text-destructive">
          {lastMove.error} They are still in {data?.folder}.
        </p>
      )}
      {(finished ?? status) && (
        <p role="status" className="text-sm text-muted-foreground">
          {finished ?? status}
        </p>
      )}

      {!data?.moving && step === "idle" && (
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2"
          onClick={() => setStep("folder")}
        >
          <FolderInput className="h-4 w-4" aria-hidden="true" />
          Move to another folder
        </Button>
      )}

      {step === "folder" && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <Label htmlFor="photo-folder">New folder</Label>
          <Input
            id="photo-folder"
            value={folder}
            placeholder={`${data?.roots[0] ?? "/photos"}/nas`}
            onChange={(e) => setFolder(e.target.value)}
            className="h-11 bg-input font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Tap through the folders below, or type the full path as the server
            sees it.
          </p>
          <FolderBrowser value={folder} onChange={setFolder} />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 flex-1"
              onClick={() => setStep("idle")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={folder.trim() === ""}
              onClick={() => setStep("pin")}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === "pin" && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm">
            Moving the photos to{" "}
            <span className="font-mono break-all">{folder.trim()}</span>
          </p>
          <ParentPinPad
            prompt="Who is moving the photos?"
            submitLabel="Move photos"
            onSubmit={submit}
          />
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full"
            onClick={() => setStep("folder")}
          >
            Back
          </Button>
        </div>
      )}
    </section>
  );
}
