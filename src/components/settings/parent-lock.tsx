import { Lock } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useFamilyMembers, useParentUnlock } from "@/api";
import { ParentPinPad } from "@/components/chores/parent-pin-pad";
import {
  type ParentSession,
  ParentSessionContext,
} from "@/components/chores/parent-session";
import { Button } from "@/components/ui/button";
import type { FamilyMember } from "@/lib/types";
import { useScreensaverStore } from "@/stores";

/** An unlocked screen locks again after this long without a tap or a key. */
export const PARENT_LOCK_IDLE_MS = 2 * 60 * 1000;

interface ParentLockProps {
  /** Whether the screen it guards is open; closing the screen locks it. */
  isOpen: boolean;
  /** Shown above the parents' faces, e.g. "Who is changing settings?" */
  prompt: string;
  /** Told when it locks, so the screen can close dialogs it opened from inside. */
  onLock?: () => void;
  /**
   * Guards one member's own screen (their profile): only their PIN opens it, and a
   * member without a PIN (a kid, or a parent who has not set one) is not asked.
   */
  memberId?: string;
  children: ReactNode;
}

/**
 * Keeps a screen (Family Settings, Preferences) behind a parent's face and PIN, on
 * every device, so a kid at the wall or on a tablet cannot change it. The server
 * checks the PIN, with the same tries and lockout as approving chores. Once
 * unlocked it stays open until the screen closes, nobody taps or types for two
 * minutes, the screensaver starts, or a parent taps Lock. Steps inside that need a
 * PIN again (moving the photos, say) go ahead as the parent who unlocked it.
 *
 * Until some parent has set a PIN it cannot lock, and says so: otherwise nobody
 * could open the settings to set one up.
 */
export function ParentLock({
  isOpen,
  prompt,
  onLock,
  memberId,
  children,
}: ParentLockProps) {
  const members = useFamilyMembers();
  const unlock = useParentUnlock();
  const screensaverActive = useScreensaverStore((s) => s.isActive);
  const [session, setSession] = useState<ParentSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activity, touched] = useReducer((n: number) => n + 1, 0);

  // Refs, so locking stays one stable function whatever the screen passes in.
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const lock = useCallback((why: string | null) => {
    if (sessionRef.current) onLockRef.current?.();
    setSession(null);
    setNotice(why);
  }, []);

  useEffect(() => {
    if (!isOpen) lock(null);
  }, [isOpen, lock]);

  useEffect(() => {
    if (screensaverActive && session) {
      lock("Locked when the screensaver started.");
    }
  }, [screensaverActive, session, lock]);

  // Any tap or key on this device counts, including in dialogs the screen opens
  // on top of itself (adding a member, say), which sit outside this component.
  useEffect(() => {
    if (!session) return;
    document.addEventListener("pointerdown", touched, true);
    document.addEventListener("keydown", touched, true);
    return () => {
      document.removeEventListener("pointerdown", touched, true);
      document.removeEventListener("keydown", touched, true);
    };
  }, [session]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activity restarts the countdown on every tap or key.
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () =>
        lock("Locked after 2 minutes without a tap. Enter a PIN to carry on."),
      PARENT_LOCK_IDLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [session, activity, lock]);

  const hasParentPin = (member: FamilyMember) =>
    (member.role ?? "PARENT") === "PARENT" && !!member.hasPin;
  const memberHasPin = members.some(
    (member) => member.id === memberId && hasParentPin(member),
  );
  // For one member, whether to ask is settled each time the screen opens: a
  // parent who sets their first PIN on their profile is not locked out mid-edit.
  const [asksMember, setAsksMember] = useState<boolean | null>(null);
  if (memberId && isOpen && asksMember === null) setAsksMember(memberHasPin);
  if (!isOpen && asksMember !== null) setAsksMember(null);

  if (memberId && !(asksMember ?? memberHasPin)) return <>{children}</>;

  const anyParentPin = members.some(hasParentPin);
  if (!anyParentPin) {
    return (
      <>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          No parent has set a PIN yet, so anyone can change these. Set one on
          your profile (open your name in the menu) to lock them.
        </p>
        {children}
      </>
    );
  }

  if (!session) {
    const open = async (approverMemberId: string, pin: string) => {
      await unlock.mutateAsync({ approverMemberId, pin });
      setNotice(null);
      setSession({
        approverMemberId,
        approverName:
          members.find((member) => member.id === approverMemberId)?.name ??
          "a parent",
        pin,
      });
    };
    return (
      <div className="space-y-4 py-4">
        {notice && (
          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}
        <ParentPinPad
          prompt={prompt}
          submitLabel="Unlock"
          onSubmit={open}
          memberId={memberId}
        />
      </div>
    );
  }

  return (
    <ParentSessionContext.Provider value={session}>
      <div className="flex items-center justify-between gap-2 pt-4">
        <p className="text-sm font-medium text-muted-foreground">
          Unlocked by {session.approverName}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => lock(null)}
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          Lock
        </Button>
      </div>
      {children}
    </ParentSessionContext.Provider>
  );
}
