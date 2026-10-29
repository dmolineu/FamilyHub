import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  isTempMemberId,
  useAddMember,
  useFamilyData,
  useFamilyMembers,
  useFamilyName,
  useRemoveMember,
  useUpdateFamily,
  useUpdateMember,
} from "@/api";
import { MemberCard, MemberFormModal } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FamilyColor, FamilyMember } from "@/lib/types";
import {
  familyNameSchema,
  type memberFormSchema,
} from "@/lib/validations/family";
import { AvatarPacksSection } from "./avatar-packs-section";

type FamilyNameFormData = z.infer<typeof familyNameSchema>;
type MemberFormData = z.infer<typeof memberFormSchema>;

/**
 * Curated US zones offered in the timezone select. The family's current zone
 * is appended when it is not in this list, so non-US families always see
 * their stored value.
 */
const CURATED_TIMEZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "America/New_York", label: "Eastern — America/New_York" },
  { id: "America/Chicago", label: "Central — America/Chicago" },
  { id: "America/Denver", label: "Mountain — America/Denver" },
  { id: "America/Phoenix", label: "Arizona — America/Phoenix" },
  { id: "America/Los_Angeles", label: "Pacific — America/Los_Angeles" },
  { id: "America/Anchorage", label: "Alaska — America/Anchorage" },
  { id: "Pacific/Honolulu", label: "Hawaii — Pacific/Honolulu" },
];

interface FamilyTabProps {
  /** Told whenever the family name has an unsaved edit or not. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Settings → Family: who the family is, its time zone and its members. */
export function FamilyTab({ onDirtyChange }: FamilyTabProps) {
  return (
    <>
      <FamilyNameSection onDirtyChange={onDirtyChange} />
      <FamilyTimezoneSection />
      <FamilyMembersSection />
      <AvatarPacksSection />
    </>
  );
}

function FamilyNameSection({ onDirtyChange }: FamilyTabProps) {
  const familyName = useFamilyName();
  const updateFamilyMutation = useUpdateFamily();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset: resetForm,
  } = useForm<FamilyNameFormData>({
    resolver: zodResolver(familyNameSchema),
    defaultValues: { name: familyName },
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSaveName = (data: FamilyNameFormData) => {
    updateFamilyMutation.mutate({ name: data.name });
    resetForm({ name: data.name });
  };

  return (
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
            aria-describedby={errors.name ? "family-name-error" : undefined}
            aria-invalid={errors.name ? "true" : undefined}
          />
          {errors.name && (
            <p id="family-name-error" className="text-sm text-destructive">
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
  );
}

function FamilyTimezoneSection() {
  // Shown straight from GET /family — undefined (no default) until it loads.
  const timezone = useFamilyData()?.timezone;
  const [saveError, setSaveError] = useState<string | null>(null);
  const updateFamilyMutation = useUpdateFamily({
    onError: (error) => setSaveError(error.message),
  });

  const saveTimezone = (zone: string) => {
    if (!zone || zone === timezone) return;
    setSaveError(null);
    updateFamilyMutation.mutate({ timezone: zone });
  };

  const useDeviceTimezone = () => {
    saveTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  };

  const zoneOptions =
    timezone && !CURATED_TIMEZONES.some((tz) => tz.id === timezone)
      ? [...CURATED_TIMEZONES, { id: timezone, label: timezone }]
      : CURATED_TIMEZONES;

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Family Timezone
      </h3>
      <div className="space-y-2">
        <Label htmlFor="family-timezone">Family timezone</Label>
        <select
          id="family-timezone"
          value={timezone ?? ""}
          onChange={(event) => saveTimezone(event.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] leading-5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {timezone === undefined && (
            <option value="" disabled>
              Loading timezone…
            </option>
          )}
          {zoneOptions.map((tz) => (
            <option key={tz.id} value={tz.id}>
              {tz.label}
            </option>
          ))}
        </select>
        <FormError message={saveError ?? undefined} />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={useDeviceTimezone}
        className="gap-2"
      >
        <LocateFixed className="h-4 w-4" />
        Use this device's timezone
      </Button>
    </section>
  );
}

function FamilyMembersSection() {
  const familyMembers = useFamilyMembers();
  const addMemberMutation = useAddMember();
  const updateMemberMutation = useUpdateMember();
  const removeMemberMutation = useRemoveMember();
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

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

  const canAddMore = familyMembers.length < 7;

  return (
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
            onRemove={() => removeMemberMutation.mutate(member.id)}
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

      <MemberFormModal
        open={isMemberFormOpen}
        onOpenChange={setIsMemberFormOpen}
        mode={editingMember ? "edit" : "add"}
        member={editingMember ?? undefined}
        usedColors={usedColorsForForm as FamilyColor[]}
        existingNames={familyMembers.map((m) => m.name)}
        onSubmit={handleMemberFormSubmit}
      />
    </section>
  );
}
