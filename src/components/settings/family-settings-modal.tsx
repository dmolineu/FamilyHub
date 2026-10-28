import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Download, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  isTempMemberId,
  useAddMember,
  useDeleteFamily,
  useExportBackup,
  useFamilyMembers,
  useFamilyName,
  useRemoveMember,
  useRestoreBackup,
  useUpdateFamily,
  useUpdateMember,
} from "@/api";
import { MemberCard, MemberFormModal } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";
import { useBackHandler } from "@/hooks";
import { formatLocalDate } from "@/lib/time-utils";
import type { BackupDocument, FamilyColor, FamilyMember } from "@/lib/types";
import {
  familyNameSchema,
  type memberFormSchema,
} from "@/lib/validations/family";
import { AvatarPacksSection } from "./avatar-packs-section";
import { PhotoSourceSection } from "./photo-source-section";
import { PhotoStorageSection } from "./photo-storage-section";
import { SignInPasswordSection } from "./sign-in-password-section";
import { TeamsSection } from "./teams-section";

type FamilyNameFormData = z.infer<typeof familyNameSchema>;
type MemberFormData = z.infer<typeof memberFormSchema>;

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

interface FamilySettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FamilySettingsModal({
  open,
  onOpenChange,
}: FamilySettingsModalProps) {
  const familyName = useFamilyName();
  const familyMembers = useFamilyMembers();

  // API mutations
  const updateFamilyMutation = useUpdateFamily();
  const addMemberMutation = useAddMember();
  const updateMemberMutation = useUpdateMember();
  const removeMemberMutation = useRemoveMember();
  const deleteFamilyMutation = useDeleteFamily({
    onSuccess: () => onOpenChange(false),
  });

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

  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  useBackHandler(showResetConfirm, () => setShowResetConfirm(false));

  // Family name form
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset: resetForm,
  } = useForm<FamilyNameFormData>({
    resolver: zodResolver(familyNameSchema),
    defaultValues: { name: familyName },
  });

  // A half-typed new password counts as unsaved too. Remounting the section
  // (a new key) is how a discard clears it.
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [passwordSectionKey, setPasswordSectionKey] = useState(0);

  // The family-name draft lives in this always-mounted component, so a discard
  // resets it; otherwise it would greet the next person who opens settings.
  const guard = useUnsavedChangesGuard({
    isDirty: isDirty || passwordDirty,
    onClose: () => onOpenChange(false),
    onDiscard: () => {
      resetForm({ name: familyName });
      setPasswordSectionKey((key) => key + 1);
      setPasswordDirty(false);
    },
  });

  const onSaveName = (data: FamilyNameFormData) => {
    updateFamilyMutation.mutate({ name: data.name });
    resetForm({ name: data.name });
  };

  // Member management
  const usedColors = familyMembers.map((m) => m.color);
  const usedColorsForForm = editingMember
    ? usedColors.filter((c) => c !== editingMember.color)
    : usedColors;

  const handleAddMember = () => {
    setEditingMember(null);
    setIsMemberFormOpen(true);
  };

  const handleEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setIsMemberFormOpen(true);
  };

  const handleMemberFormSubmit = (data: MemberFormData) => {
    if (editingMember) {
      // The server replaces the whole member, so carry over what this form
      // does not edit (email, photo, birthday) instead of clearing it.
      updateMemberMutation.mutate({
        id: editingMember.id,
        ...data,
        email: editingMember.email,
        avatarUrl: editingMember.avatarUrl ?? null,
        birthday: editingMember.birthday ?? null,
      });
    } else {
      addMemberMutation.mutate(data);
    }
    setEditingMember(null);
  };

  const handleRemoveMember = (memberId: string) => {
    removeMemberMutation.mutate(memberId);
  };

  // Reset family
  const handleResetFamily = () => {
    deleteFamilyMutation.mutate();
  };

  const canAddMore = familyMembers.length < 7;

  return (
    <>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={(next) =>
          next ? onOpenChange(true) : guard.requestClose()
        }
        mobileNestedDialogOpenRef={guard.nestedDialogOpenRef}
        title="Family Settings"
        initialHeight="full"
        dialogClassName="max-w-lg"
        titleClassName="text-xl"
        desktopHeaderRight={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={guard.requestClose}
            className="h-11 w-11"
          >
            <X className="h-4 w-4" />
          </Button>
        }
      >
        <div className="space-y-8 py-4">
          {/* Family Name Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Family Name
            </h3>
            <form
              onSubmit={handleSubmit(onSaveName)}
              className="flex gap-2 items-start"
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor="familyName" className="sr-only">
                  Family Name
                </Label>
                <Input
                  id="familyName"
                  placeholder="Enter family name"
                  {...register("name")}
                  aria-describedby={
                    errors.name ? "family-name-error" : undefined
                  }
                  aria-invalid={errors.name ? "true" : undefined}
                />
                {errors.name && (
                  <p
                    id="family-name-error"
                    className="text-sm text-destructive"
                  >
                    {errors.name.message}
                  </p>
                )}
              </div>
              {isDirty && (
                <Button type="submit" size="sm">
                  Save
                </Button>
              )}
            </form>
          </section>

          {/* Family Members Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Family Members
              </h3>
              {canAddMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddMember}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {familyMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  onEdit={() => handleEditMember(member)}
                  onRemove={() => handleRemoveMember(member.id)}
                  canRemove={familyMembers.length > 1}
                  isPending={isTempMemberId(member.id)}
                />
              ))}
            </div>

            {!canAddMore && (
              <p className="text-sm text-muted-foreground text-center">
                Maximum of 7 family members reached
              </p>
            )}
          </section>

          <AvatarPacksSection />

          <TeamsSection />

          <PhotoStorageSection />

          <PhotoSourceSection />

          <SignInPasswordSection
            key={passwordSectionKey}
            onDirtyChange={setPasswordDirty}
          />

          {/* Backup — a file with everything, and the way back from one. */}
          <section className="space-y-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Backup
            </h3>
            <p className="text-sm text-muted-foreground">
              Download a file with everything in Family Hub, or restore from
              one. Restoring replaces what is here now.
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
                    This will delete all family data and return to the setup
                    wizard. This action cannot be undone.
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
        </div>
      </ResponsiveFormDialog>

      {guard.dialog}

      {/* Member Form Modal */}
      <MemberFormModal
        open={isMemberFormOpen}
        onOpenChange={setIsMemberFormOpen}
        mode={editingMember ? "edit" : "add"}
        member={editingMember ?? undefined}
        usedColors={usedColorsForForm as FamilyColor[]}
        existingNames={familyMembers.map((m) => m.name)}
        onSubmit={handleMemberFormSubmit}
      />

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
            <Button variant="destructive" onClick={handleResetFamily}>
              Yes, Reset Everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
