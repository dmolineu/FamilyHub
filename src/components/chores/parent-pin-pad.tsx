import { Delete } from "lucide-react";
import { useState } from "react";
import { useFamilyMembers } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { colorMap, type FamilyMember } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ParentPinPadProps {
  /** Shown above the parents' faces, e.g. "Who is approving?" */
  prompt: string;
  /** Label of the button that sends the PIN, e.g. "Approve 2 chores". */
  submitLabel: string;
  /** Rejects with an Error whose message is shown (tries left, locked). */
  onSubmit: (approverMemberId: string, pin: string) => Promise<unknown>;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const MIN_PIN = 4;
const MAX_PIN = 6;

function isParent(member: FamilyMember): boolean {
  // Caches from before roles existed carry no role; those members are parents.
  return (member.role ?? "PARENT") === "PARENT";
}

function namesList(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Face first, then PIN. Each parent has their own PIN and their own lockout,
 * so the parent says who they are before typing it. The keypad suits the wall;
 * the field beneath it takes a keyboard on a laptop. The PIN lives only in this
 * component's state and is cleared after a refusal.
 */
export function ParentPinPad({
  prompt,
  submitLabel,
  onSubmit,
}: ParentPinPadProps) {
  const members = useFamilyMembers();
  const parents = members.filter(isParent);
  const ready = parents.filter((member) => member.hasPin);
  const withoutPin = parents.filter((member) => !member.hasPin);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setChecking] = useState(false);
  const chosen = ready.find((member) => member.id === chosenId) ?? null;

  if (!chosen) {
    if (ready.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No parent has set a PIN yet. A parent can set one on their profile in
          Family Settings.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">{prompt}</p>
        <div className="flex flex-wrap gap-3">
          {ready.map((parent) => {
            const colors = colorMap[parent.color];
            return (
              <button
                key={parent.id}
                type="button"
                onClick={() => {
                  setChosenId(parent.id);
                  setPin("");
                  setError(null);
                }}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-full py-2 pr-5 pl-2 text-base font-semibold transition-opacity hover:opacity-80",
                  colors?.light,
                  colors?.text,
                )}
              >
                {parent.avatarUrl ? (
                  <img
                    src={parent.avatarUrl}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full text-white",
                      colors?.bg,
                    )}
                  >
                    {parent.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {parent.name}
              </button>
            );
          })}
        </div>
        {withoutPin.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {namesList(withoutPin.map((member) => member.name))}{" "}
            {withoutPin.length === 1 ? "hasn't" : "haven't"} set a PIN yet.
          </p>
        )}
      </div>
    );
  }

  const append = (digit: string) => {
    setError(null);
    setPin((current) => (current + digit).slice(0, MAX_PIN));
  };

  const submit = async () => {
    if (pin.length < MIN_PIN || isChecking) return;
    setChecking(true);
    setError(null);
    try {
      await onSubmit(chosen.id, pin);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "That didn't work. Try again.",
      );
      setPin("");
    } finally {
      setChecking(false);
    }
  };

  return (
    <form
      className="mx-auto max-w-xs space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="parent-pin" className="text-base">
          {chosen.name}'s PIN
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => {
            setChosenId(null);
            setPin("");
            setError(null);
          }}
        >
          Not {chosen.name}?
        </Button>
      </div>
      <Input
        id="parent-pin"
        type="password"
        inputMode="numeric"
        // Not a saved password: keeps password managers from filling the
        // family's sign-in password in here (they ignore "off").
        autoComplete="one-time-code"
        maxLength={MAX_PIN}
        value={pin}
        onChange={(event) => {
          setError(null);
          setPin(event.target.value.replace(/\D/g, "").slice(0, MAX_PIN));
        }}
        className="h-12 bg-input text-center text-2xl tracking-[0.5em]"
        aria-invalid={error ? true : undefined}
      />
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="outline"
            className="h-14 text-xl font-semibold"
            onClick={() => append(digit)}
          >
            {digit}
          </Button>
        ))}
        <span aria-hidden="true" />
        <Button
          type="button"
          variant="outline"
          className="h-14 text-xl font-semibold"
          onClick={() => append("0")}
        >
          0
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-14"
          aria-label="Delete last digit"
          onClick={() => setPin((current) => current.slice(0, -1))}
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="h-12 w-full"
        disabled={pin.length < MIN_PIN || isChecking}
      >
        {isChecking ? "Checking…" : submitLabel}
      </Button>
    </form>
  );
}

export type { ParentPinPadProps };
