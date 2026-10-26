import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  useFamilyData,
  useFamilyMemberById,
  useFamilyMembers,
  useUpdateMember,
} from "@/api";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";
import { countdownLabel, nextBirthday, todayInZone } from "@/lib/birthdays";
import {
  colorMap,
  type FamilyColor,
  type FamilyMember,
  type MemberBirthday,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  createMemberProfileSchema,
  type MemberProfileFormData,
} from "@/lib/validations/family";
import { GoogleCalendarSection } from "./google-calendar-section";
import { MemberRoleSection } from "./member-role-section";

interface MemberProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
}

export function MemberProfileModal({
  open,
  onOpenChange,
  memberId,
}: MemberProfileModalProps) {
  const member = useFamilyMemberById(memberId);
  const familyMembers = useFamilyMembers();
  const familyTimezone = useFamilyData()?.timezone;
  const updateMemberMutation = useUpdateMember();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // A role change or PIN being typed in the section below counts as unsaved too.
  const [roleSectionDirty, setRoleSectionDirty] = useState(false);

  const existingNames = familyMembers.map((m) => m.name);
  const usedColors = familyMembers
    .filter((m) => m.id !== memberId)
    .map((m) => m.color);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<MemberProfileFormData>({
    resolver: zodResolver(
      createMemberProfileSchema(existingNames, member?.name),
    ),
    defaultValues: {
      name: member?.name ?? "",
      color: member?.color ?? "coral",
      email: member?.email ?? "",
      ...birthdayFormValues(member?.birthday),
    },
  });

  const selectedColor = watch("color");
  const watchedBirthday = birthdayFromForm({
    birthMonth: watch("birthMonth") ?? "",
    birthDay: watch("birthDay") ?? "",
    birthYear: watch("birthYear") ?? "",
  });
  const birthdayCountdown = describeCountdown(watchedBirthday, familyTimezone);

  // Reset form when member changes
  useEffect(() => {
    if (member) {
      reset({
        name: member.name,
        color: member.color,
        email: member.email ?? "",
        ...birthdayFormValues(member.birthday),
      });
    }
  }, [member, reset]);

  // Clear avatar error when dialog reopens
  useEffect(() => {
    if (open) setAvatarError(null);
  }, [open]);

  const guard = useUnsavedChangesGuard({
    isDirty: isDirty || roleSectionDirty,
    onClose: () => onOpenChange(false),
    onDiscard: () => {
      setRoleSectionDirty(false);
      if (member) {
        reset({
          name: member.name,
          color: member.color,
          email: member.email ?? "",
          ...birthdayFormValues(member.birthday),
        });
      }
    },
  });

  if (!member) return null;

  const onSubmit = (data: MemberProfileFormData) => {
    updateMemberMutation.mutate({
      id: memberId,
      name: data.name,
      color: data.color,
      email: data.email || undefined,
      avatarUrl: member.avatarUrl ?? undefined,
      birthday: birthdayFromForm(data),
    });
    onOpenChange(false);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file");
      return;
    }

    // Validate file size (max 500KB for localStorage)
    if (file.size > 500 * 1024) {
      setAvatarError("Image must be smaller than 500KB");
      return;
    }

    setAvatarError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateMemberMutation.mutate({
        id: memberId,
        name: member.name,
        color: member.color,
        email: member.email ?? undefined,
        avatarUrl: base64,
        birthday: member.birthday ?? null,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    updateMemberMutation.mutate({
      id: memberId,
      name: member.name,
      color: member.color,
      email: member.email ?? undefined,
      avatarUrl: null,
      birthday: member.birthday ?? null,
    });
  };

  const colors = colorMap[member.color];

  return (
    <>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={(next) =>
          next ? onOpenChange(true) : guard.requestClose()
        }
        mobileNestedDialogOpenRef={guard.nestedDialogOpenRef}
        title="Member Profile"
        initialHeight="full"
        dialogClassName="max-w-sm"
        titleClassName="text-xl"
        desktopHeaderRight={
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={guard.requestClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold",
                    colors?.bg,
                  )}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                aria-label="Upload avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
              aria-label="Upload avatar image"
            />
            {avatarError && (
              <p className="text-sm text-destructive" role="alert">
                {avatarError}
              </p>
            )}
            {member.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                className="text-muted-foreground gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Remove photo
              </Button>
            )}
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...register("name")}
              aria-describedby={errors.name ? "name-error" : undefined}
              aria-invalid={errors.name ? "true" : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker
              value={selectedColor}
              onChange={(color) =>
                setValue("color", color, { shouldDirty: true })
              }
              usedColors={usedColors as FamilyColor[]}
              error={errors.color?.message}
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              {...register("email")}
              aria-describedby={
                errors.email ? "email-error" : "email-description"
              }
              aria-invalid={errors.email ? "true" : undefined}
            />
            {errors.email ? (
              <p id="email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            ) : (
              <p
                id="email-description"
                className="text-xs text-muted-foreground"
              >
                Used for notifications and Google Calendar sync
              </p>
            )}
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <Label htmlFor="birthYear">Birthday</Label>
            <div className="flex gap-2">
              <select
                aria-label="Birthday month"
                {...register("birthMonth")}
                className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-[15px]"
              >
                <option value="">Month</option>
                {BIRTHDAY_MONTHS.map((name, index) => (
                  <option key={name} value={String(index + 1)}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Birthday day"
                {...register("birthDay")}
                className="h-11 w-24 rounded-lg border border-input bg-background px-3 text-[15px]"
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(
                  (day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ),
                )}
              </select>
              <Input
                id="birthYear"
                aria-label="Birth year (optional)"
                inputMode="numeric"
                placeholder="Year (optional)"
                className="w-36"
                {...register("birthYear")}
              />
            </div>
            {errors.birthMonth || errors.birthDay || errors.birthYear ? (
              <p className="text-sm text-destructive">
                {errors.birthMonth?.message ??
                  errors.birthDay?.message ??
                  errors.birthYear?.message}
              </p>
            ) : birthdayCountdown ? (
              <p className="text-xs text-muted-foreground">
                {birthdayCountdown}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The year is optional; leave it blank to keep an age private.
              </p>
            )}
          </div>

          {/* Parent or kid, and a parent's own PIN for approving chores */}
          <MemberRoleSection
            memberId={memberId}
            onDirtyChange={setRoleSectionDirty}
          />

          {/* Google Calendar */}
          <GoogleCalendarSection
            memberId={memberId}
            memberEmail={watch("email") || member?.email || ""}
            memberName={member?.name || ""}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={guard.requestClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isDirty}>
              Save Changes
            </Button>
          </div>
        </form>
      </ResponsiveFormDialog>
      {guard.dialog}
    </>
  );
}

const BIRTHDAY_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function birthdayFormValues(birthday: FamilyMember["birthday"]) {
  return {
    birthMonth: birthday ? String(birthday.month) : "",
    birthDay: birthday ? String(birthday.day) : "",
    birthYear: birthday?.year ? String(birthday.year) : "",
  };
}

function birthdayFromForm(data: {
  birthMonth: string;
  birthDay: string;
  birthYear: string;
}): MemberBirthday | null {
  if (data.birthMonth === "" || data.birthDay === "") return null;
  const year = data.birthYear.trim();
  return {
    month: Number(data.birthMonth),
    day: Number(data.birthDay),
    year: /^\d{4}$/.test(year) ? Number(year) : null,
  };
}

/** "In 9 days · turns 10", in the family's time zone. */
function describeCountdown(
  birthday: MemberBirthday | null,
  timeZone: string | undefined,
): string | null {
  if (!birthday) return null;
  try {
    const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const next = nextBirthday(birthday, todayInZone(new Date(), zone));
    const label = countdownLabel(next.daysUntil);
    return next.turning ? `${label} · turns ${next.turning}` : label;
  } catch {
    return null;
  }
}
