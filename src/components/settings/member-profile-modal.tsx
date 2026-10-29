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
import { MemberAvatar } from "@/components/calendar/components/member-avatar";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";
import { countdownLabel, nextBirthday, todayInZone } from "@/lib/birthdays";
import type { FamilyColor, FamilyMember, MemberBirthday } from "@/lib/types";
import {
  createMemberProfileSchema,
  type MemberProfileFormData,
} from "@/lib/validations/family";
import { AvatarPicker } from "./avatar-picker";
import { GoogleCalendarSection } from "./google-calendar-section";
import { MemberRoleSection } from "./member-role-section";
import { MemberThemeSection } from "./member-theme-section";
import { ParentLock } from "./parent-lock";

interface MemberProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  /**
   * Told once when the profile itself shows: at once for a kid or a parent
   * without a PIN, after the PIN for a parent with one.
   */
  onShown?: () => void;
}

/** Calls back once, when first rendered inside the profile's PIN lock. */
function ShownSignal({ onShown }: { onShown?: () => void }) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the profile first shows.
  useEffect(() => {
    onShown?.();
  }, []);
  return null;
}

export function MemberProfileModal({
  open,
  onOpenChange,
  memberId,
  onShown,
}: MemberProfileModalProps) {
  const member = useFamilyMemberById(memberId);
  const familyMembers = useFamilyMembers();
  const familyTimezone = useFamilyData()?.timezone;
  const updateMemberMutation = useUpdateMember();
  // Choosing a picture takes over the dialog; the form stays mounted underneath so
  // half-typed edits (including a PIN in the role section) survive going back.
  const [choosingAvatar, setChoosingAvatar] = useState(false);
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

  // The saved member changes under an open form: a role, PIN or picture saved in
  // this dialog, or another device's edit. Only the fields nobody is editing take
  // the saved values, so half-typed changes survive; another member starts afresh.
  // keepDirty too: keepDirtyValues alone keeps the edits but clears isDirty, which
  // would grey out Save Changes with unsaved edits on screen.
  const shownMemberId = useRef(memberId);
  useEffect(() => {
    if (member) {
      const sameMember = shownMemberId.current === member.id;
      shownMemberId.current = member.id;
      reset(
        {
          name: member.name,
          color: member.color,
          email: member.email ?? "",
          ...birthdayFormValues(member.birthday),
        },
        { keepDirtyValues: sameMember, keepDirty: sameMember },
      );
    }
  }, [member, reset]);

  // Each opening starts on the profile with no stale avatar error.
  useEffect(() => {
    if (open) {
      setAvatarError(null);
      setChoosingAvatar(false);
    }
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

  const saveAvatar = (avatarUrl: string | null) => {
    setAvatarError(null);
    updateMemberMutation.mutate(
      {
        id: memberId,
        name: member.name,
        color: member.color,
        email: member.email ?? undefined,
        avatarUrl,
        birthday: member.birthday ?? null,
      },
      {
        onSuccess: () => setChoosingAvatar(false),
        onError: (error) =>
          setAvatarError(error.message || "The picture could not be saved"),
      },
    );
  };

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
        {/* A parent's own profile opens with their PIN, so a kid cannot change it. */}
        <ParentLock
          isOpen={open}
          memberId={memberId}
          prompt={`Enter ${member.name}'s PIN`}
          onLock={() => setChoosingAvatar(false)}
        >
          <ShownSignal onShown={onShown} />
          {choosingAvatar && (
            <AvatarPicker
              member={member}
              onChoose={saveAvatar}
              onBack={() => {
                setAvatarError(null);
                setChoosingAvatar(false);
              }}
              saving={updateMemberMutation.isPending}
              error={avatarError}
            />
          )}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 py-4"
            hidden={choosingAvatar}
          >
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setChoosingAvatar(true)}
                className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Change picture"
              >
                <MemberAvatar
                  name={member.name}
                  color={member.color}
                  avatarUrl={member.avatarUrl}
                  className="h-20 w-20 text-2xl"
                />
                <span className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
              {avatarError && !choosingAvatar && (
                <p className="text-sm text-destructive" role="alert">
                  {avatarError}
                </p>
              )}
              {member.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => saveAvatar(null)}
                  className="text-muted-foreground gap-1 min-h-11"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove picture
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

            {/* Their own look, shown on a screen when they are tapped */}
            <MemberThemeSection memberId={memberId} />

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
        </ParentLock>
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
