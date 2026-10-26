import { type FormEvent, useEffect, useState } from "react";
import { useChangePassword } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignInPasswordSectionProps {
  /** Told whenever a new password is half-entered (unsaved) or not. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Same bounds the server enforces at sign-up. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 100;

/**
 * Changing the password the whole family signs in with. It needs the current
 * password, because being at a signed-in screen (the kitchen wall) is not proof
 * of knowing it. There is no forgotten-password screen: whoever runs the server
 * resets it there.
 */
export function SignInPasswordSection({
  onDirtyChange,
}: SignInPasswordSectionProps) {
  const changePassword = useChangePassword();
  const [isEditing, setEditing] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const isDirty = isEditing && (current !== "" || next !== "" || again !== "");
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const close = () => {
    setEditing(false);
    setCurrent("");
    setNext("");
    setAgain("");
    setError(null);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (changePassword.isPending) return;
    if (!current) {
      setError("Enter the current password");
      return;
    }
    if (next.length < MIN_LENGTH || next.length > MAX_LENGTH) {
      setError(`A password is ${MIN_LENGTH} to ${MAX_LENGTH} characters`);
      return;
    }
    if (next !== again) {
      setError("The new passwords don't match");
      return;
    }
    setError(null);
    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          close();
          setStatus(
            "Password changed. Other phones, laptops and the wall will ask for the new one.",
          );
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Sign-in password
      </h3>
      <p className="text-sm text-muted-foreground">
        The password everyone uses to sign in to this family. Changing it signs
        out every other phone, laptop and wall screen. If nobody remembers it,
        whoever runs the server can reset it.
      </p>

      {!isEditing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => {
            setStatus(null);
            setEditing(true);
          }}
        >
          Change password
        </Button>
      )}

      {isEditing && (
        <form
          onSubmit={save}
          className="space-y-2 rounded-lg border border-border p-3"
        >
          <Label htmlFor="current-sign-in-password">Current password</Label>
          <Input
            id="current-sign-in-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className="bg-input"
          />
          <Label htmlFor="new-sign-in-password">New password</Label>
          <Input
            id="new-sign-in-password"
            type="password"
            autoComplete="new-password"
            maxLength={MAX_LENGTH}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className="bg-input"
          />
          <Label htmlFor="new-sign-in-password-again">New password again</Label>
          <Input
            id="new-sign-in-password-again"
            type="password"
            autoComplete="new-password"
            maxLength={MAX_LENGTH}
            value={again}
            onChange={(event) => setAgain(event.target.value)}
            className="bg-input"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              className="min-h-11"
              disabled={changePassword.isPending}
            >
              {changePassword.isPending ? "Saving…" : "Save password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={close}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}
    </section>
  );
}
