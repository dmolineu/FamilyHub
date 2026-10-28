import { FolderOpen, Loader2 } from "lucide-react";
import { useState } from "react";
import { useChoosePhotoSource, usePhotoSource } from "@/api";
import { ParentPinPad } from "@/components/chores/parent-pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "idle" | "folder" | "pin-choose" | "pin-clear";

/**
 * Family Settings: a folder of photos the family already has (the NAS Photos share, a
 * phone backup) shown in the slideshow beside uploads. Only read, never changed;
 * choosing or clearing it takes a parent's PIN.
 */
export function PhotoSourceSection() {
  const source = usePhotoSource();
  const choose = useChoosePhotoSource();
  const [step, setStep] = useState<Step>("idle");
  const [folder, setFolder] = useState("");
  const data = source.data;

  const submit = async (approverMemberId: string, pin: string) => {
    await choose.mutateAsync({
      approverMemberId,
      pin,
      folder: step === "pin-clear" ? "" : folder.trim(),
    });
    setStep("idle");
    setFolder("");
  };

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Photos from a folder
        </h3>
        <p className="text-sm text-muted-foreground">
          Show photos the family already has, such as the NAS Photos share, in
          the slideshow too. The folder is only read, never changed.
        </p>
      </div>

      {data && !data.folder && step === "idle" && (
        <p className="text-sm text-muted-foreground">
          Not showing a folder of existing photos.
        </p>
      )}

      {data?.folder && (
        <div className="space-y-1 rounded-lg bg-muted px-3 py-2">
          <p className="break-all font-mono text-sm text-foreground">
            {data.folder}
          </p>
          {data.indexing ? (
            <p className="flex items-center gap-2 text-xs text-foreground">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              Reading the folder…
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {data.photoCount.toLocaleString("en-US")} photo
              {data.photoCount === 1 ? "" : "s"} in the slideshow.
              {data.skippedHeic > 0 &&
                ` ${data.skippedHeic.toLocaleString("en-US")} HEIC photo${data.skippedHeic === 1 ? " is" : "s are"} not shown: they need converting to JPEG first.`}
            </p>
          )}
        </div>
      )}

      {data?.error && (
        <p role="alert" className="text-sm text-destructive">
          {data.error}
        </p>
      )}

      {step === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2"
            onClick={() => {
              setFolder(data?.folder ?? "");
              setStep("folder");
            }}
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            {data?.folder ? "Choose another folder" : "Choose a folder"}
          </Button>
          {data?.folder && (
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => setStep("pin-clear")}
            >
              Stop showing
            </Button>
          )}
        </div>
      )}

      {step === "folder" && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <Label htmlFor="photo-source-folder">Folder of photos</Label>
          <Input
            id="photo-source-folder"
            value={folder}
            placeholder="/photos/nas/Photos"
            onChange={(e) => setFolder(e.target.value)}
            className="h-11 bg-input font-mono"
          />
          <p className="text-xs text-muted-foreground">
            The full path as the server sees it, under the folders mounted for
            photos.
          </p>
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
              onClick={() => setStep("pin-choose")}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {(step === "pin-choose" || step === "pin-clear") && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm">
            {step === "pin-clear" ? (
              "Stop showing the folder's photos in the slideshow"
            ) : (
              <>
                Show the photos in{" "}
                <span className="font-mono break-all">{folder.trim()}</span>
              </>
            )}
          </p>
          <ParentPinPad
            prompt="Which parent is this?"
            submitLabel={
              step === "pin-clear" ? "Stop showing them" : "Show these photos"
            }
            onSubmit={submit}
          />
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full"
            onClick={() => setStep(step === "pin-clear" ? "idle" : "folder")}
          >
            Back
          </Button>
        </div>
      )}
    </section>
  );
}
