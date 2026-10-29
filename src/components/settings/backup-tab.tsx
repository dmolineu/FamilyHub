import { AlertTriangle, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useDeleteFamily, useExportBackup, useRestoreBackup } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBackHandler } from "@/hooks";
import { formatLocalDate } from "@/lib/time-utils";
import type { BackupDocument } from "@/lib/types";

/** Saves the document as familyhub-backup-<today>.json through a transient link. */
function downloadBackup(document: BackupDocument): void {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `familyhub-backup-${formatLocalDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Rejects anything that is not a JSON object with the backup envelope. */
function readBackupFile(file: File): Promise<BackupDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (
          parsed !== null &&
          typeof parsed === "object" &&
          (parsed as BackupDocument).version === 1 &&
          typeof (parsed as BackupDocument).family?.name === "string"
        ) {
          resolve(parsed as BackupDocument);
        } else {
          reject(new Error("Not a backup"));
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
}

function describeExportDate(exportedAt: string): string {
  const parsed = new Date(exportedAt);
  return Number.isNaN(parsed.getTime()) ? exportedAt : parsed.toLocaleString();
}

interface BackupTabProps {
  /** Told once the family is reset, so the settings can close. */
  onFamilyReset: () => void;
}

/** Settings → Backup: a file with everything, the way back from one, and a reset. */
export function BackupTab({ onFamilyReset }: BackupTabProps) {
  const deleteFamilyMutation = useDeleteFamily({ onSuccess: onFamilyReset });

  // Backup and restore. The document is the file; nothing is interpreted here
  // beyond the envelope needed to describe it before the family confirms.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupDocument | null>(
    null,
  );
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const exportBackup = useExportBackup({
    onSuccess: (document) => {
      setBackupError(null);
      downloadBackup(document);
    },
    onError: (error) => setBackupError(error.message),
  });
  const restoreBackup = useRestoreBackup({
    onSuccess: (response) => {
      const r = response.data;
      setPendingRestore(null);
      setBackupError(null);
      setRestoreStatus(
        `Backup restored: ${r.members} members, ${r.chores} chores, ${r.lists} lists, ${r.recipes} recipes, ${r.meals} meals, ${r.events} events.`,
      );
    },
    onError: (error) => {
      setPendingRestore(null);
      setBackupError(error.message);
    },
  });

  const handleBackupFileChosen = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // Allow choosing the same file again after an error or a restore.
    event.target.value = "";
    if (!file) return;
    setRestoreStatus(null);
    readBackupFile(file).then(
      (document) => {
        setBackupError(null);
        setPendingRestore(document);
      },
      () => setBackupError("This file is not a Family Hub backup."),
    );
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  useBackHandler(showResetConfirm, () => setShowResetConfirm(false));

  return (
    <>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Backup
        </h3>
        <p className="text-sm text-muted-foreground">
          Download a file with everything in Family Hub, or restore from one.
          Restoring replaces what is here now.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={exportBackup.isPending}
            onClick={() => exportBackup.mutate()}
          >
            <Download className="h-4 w-4" />
            {exportBackup.isPending ? "Preparing…" : "Download backup"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={restoreBackup.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Restore from file
          </Button>
          <input
            ref={fileInputRef}
            id="restore-backup-file"
            type="file"
            accept="application/json,.json"
            aria-label="Restore from file"
            className="sr-only"
            onChange={handleBackupFileChosen}
          />
        </div>
        {backupError && (
          <p className="text-sm text-destructive">{backupError}</p>
        )}
        {restoreStatus && (
          <p role="status" className="text-sm text-muted-foreground">
            {restoreStatus}
          </p>
        )}
      </section>

      {/* Reset — the only action here, so the heading names it rather than
        using a jargon warning label. The consequence copy sits below. */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">
          Reset this family
        </h3>
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Reset Family</p>
              <p className="text-sm text-muted-foreground mt-1">
                This will delete all family data and return to the setup wizard.
                This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="mt-3"
              >
                Reset Family
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestore(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              {pendingRestore
                ? `This replaces everything with the backup of "${pendingRestore.family.name}" from ${describeExportDate(pendingRestore.exportedAt)}. Current data will be lost.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setPendingRestore(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={restoreBackup.isPending}
              onClick={() => {
                if (pendingRestore) restoreBackup.mutate(pendingRestore);
              }}
            >
              {restoreBackup.isPending ? "Restoring…" : "Yes, restore"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Family?</DialogTitle>
            <DialogDescription>
              This will permanently delete all family data including members and
              their events. You'll need to set up your family again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteFamilyMutation.mutate()}
            >
              Yes, Reset Everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
