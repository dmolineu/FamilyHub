import { type KeyboardEvent, useEffect, useState } from "react";
import { useFamilyMemberById, useSetMemberPin, useSetMemberRole } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberRole } from "@/lib/types";

interface MemberRoleSectionProps {
  memberId: string;
  /** Told whenever a role change or a PIN is half-entered (unsaved) or not. */
  onDirtyChange?: (dirty: boolean) => void;
}

// Exactly four: the PIN pad checks a PIN the moment its fourth digit is in.
const PIN_PATTERN = /^\d{4}$/;

/** Enter in these fields must act here, not submit the profile form around them. */
function onEnter(action: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      action();
    }
  };
}

/**
 * Parent or kid, and a parent's own PIN. Both changes need the family password:
 * the family shares one login, so without it anyone at the wall could make
 * themselves a parent or set a PIN and approve their own chores.
 */
export function MemberRoleSection({
  memberId,
  onDirtyChange,
}: MemberRoleSectionProps) {
  const member = useFamilyMemberById(memberId);
  const setRole = useSetMemberRole();
  const setPin = useSetMemberPin();
  const [pendingRole, setPendingRole] = useState<MemberRole | null>(null);
  const [rolePassword, setRolePassword] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isEditingPin, setEditingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinPassword, setPinPassword] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const isDirty =
    (pendingRole !== null && rolePassword !== "") ||
    (isEditingPin && (newPin !== "" || pinPassword !== ""));
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  if (!member) return null;
  const role: MemberRole = member.role ?? "PARENT";

  const startRoleChange = (next: MemberRole) => {
    if (next === role) {
      setPendingRole(null);
      return;
    }
    setEditingPin(false);
    setPendingRole(next);
    setRolePassword("");
    setRoleError(null);
  };

  const confirmRole = () => {
    if (!pendingRole || !rolePassword || setRole.isPending) return;
    setRoleError(null);
    setRole.mutate(
      { id: memberId, role: pendingRole, password: rolePassword },
      {
        onSuccess: () => {
          setPendingRole(null);
          setRolePassword("");
        },
        onError: (error) => setRoleError(error.message),
      },
    );
  };

  const startPinChange = () => {
    setPendingRole(null);
    setEditingPin(true);
    setNewPin("");
    setPinPassword("");
    setPinError(null);
  };

  const savePin = () => {
    if (setPin.isPending) return;
    if (!PIN_PATTERN.test(newPin)) {
      setPinError("A PIN is 4 digits");
      return;
    }
    if (!pinPassword) {
      setPinError("Enter the family password");
      return;
    }
    setPinError(null);
    setPin.mutate(
      { id: memberId, pin: newPin, password: pinPassword },
      {
        onSuccess: () => {
          setEditingPin(false);
          setNewPin("");
          setPinPassword("");
        },
        onError: (error) => setPinError(error.message),
      },
    );
  };

  return (
    <section className="space-y-3">
      <p className="text-sm font-medium text-foreground">Parent or kid</p>
      <div className="grid grid-cols-2 gap-2">
        {(["PARENT", "KID"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant={role === option ? "default" : "outline"}
            aria-pressed={role === option}
            className="min-h-11"
            onClick={() => startRoleChange(option)}
          >
            {option === "PARENT" ? "Parent" : "Kid"}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        A kid's ticked chores wait for a parent's PIN before their points count.
        Changing this or a PIN asks for the password your family signs in with.
      </p>

      {pendingRole && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor={`role-password-${memberId}`}>
            Family sign-in password
          </Label>
          <Input
            id={`role-password-${memberId}`}
            type="password"
            autoComplete="current-password"
            value={rolePassword}
            onChange={(event) => setRolePassword(event.target.value)}
            onKeyDown={onEnter(confirmRole)}
            className="bg-input"
          />
          {roleError && (
            <p role="alert" className="text-sm text-destructive">
              {roleError}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={!rolePassword || setRole.isPending}
              onClick={confirmRole}
            >
              Make {member.name} a {pendingRole === "KID" ? "kid" : "parent"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setPendingRole(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {role === "PARENT" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {member.hasPin ? "PIN set" : "No PIN yet"}
            </span>
            {!isEditingPin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={startPinChange}
              >
                {member.hasPin ? "Change PIN" : "Set PIN"}
              </Button>
            )}
          </div>
          {isEditingPin && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor={`new-pin-${memberId}`}>New PIN</Label>
              <Input
                id={`new-pin-${memberId}`}
                type="password"
                inputMode="numeric"
                // Chrome ignores "off" on password fields and would fill in the
                // saved sign-in password; "new-password" marks a new secret.
                autoComplete="new-password"
                maxLength={4}
                value={newPin}
                onChange={(event) =>
                  setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                onKeyDown={onEnter(savePin)}
                className="w-40 bg-input tracking-[0.3em]"
              />
              <Label htmlFor={`pin-password-${memberId}`}>
                Family sign-in password
              </Label>
              <Input
                id={`pin-password-${memberId}`}
                type="password"
                autoComplete="current-password"
                value={pinPassword}
                onChange={(event) => setPinPassword(event.target.value)}
                onKeyDown={onEnter(savePin)}
                className="bg-input"
              />
              <p className="text-xs text-muted-foreground">
                4 digits. Only {member.name} should know it.
              </p>
              {pinError && (
                <p role="alert" className="text-sm text-destructive">
                  {pinError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={setPin.isPending}
                  onClick={savePin}
                >
                  Save PIN
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => setEditingPin(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
