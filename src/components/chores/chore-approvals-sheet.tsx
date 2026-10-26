import { Lock } from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import {
  ApiException,
  useDecideChoreApprovals,
  useFamilyData,
  useFamilyMembers,
  useOpenPendingApprovals,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import { formatDateTimeInZone } from "@/lib/chore-times";
import type { PendingChoreApproval } from "@/lib/types";
import { useScreensaverStore } from "@/stores";
import { ParentPinPad } from "./parent-pin-pad";

interface ChoreApprovalsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/** An unlocked sheet relocks after this long without a tap. */
export const APPROVALS_AUTO_LOCK_MS = 2 * 60 * 1000;

interface Session {
  approverMemberId: string;
  approverName: string;
  /** Held in this component's memory only, never stored. */
  pin: string;
}

function chores(count: number): string {
  return `${count} chore${count === 1 ? "" : "s"}`;
}

function pointsLabel(item: PendingChoreApproval): string {
  if (item.points === null) return "No points set";
  return `${item.points} point${item.points === 1 ? "" : "s"}`;
}

/**
 * Kids' ticked chores waiting for a parent. One PIN opens the list for a whole
 * round of approving; closing the sheet, two minutes without a tap, or the
 * screensaver starting locks it again, so a kid who comes along next finds it
 * asking for a PIN. Either parent can decide any kid's chores. The same daily
 * chore ticked on several days waits once per day, each with its own time.
 */
export function ChoreApprovalsSheet({
  isOpen,
  onClose,
}: ChoreApprovalsSheetProps) {
  const openPending = useOpenPendingApprovals();
  const decide = useDecideChoreApprovals();
  const members = useFamilyMembers();
  const timeZone = useFamilyData()?.timezone;
  const screensaverActive = useScreensaverStore((s) => s.isActive);

  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<PendingChoreApproval[]>([]);
  const [decidedAny, setDecidedAny] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, touched] = useReducer((n: number) => n + 1, 0);

  const lock = useCallback((notice: string | null) => {
    setSession(null);
    setItems([]);
    setDecidedAny(false);
    setStatus(null);
    setRejectingId(null);
    setReason("");
    setLockNotice(notice);
  }, []);

  useEffect(() => {
    if (!isOpen) lock(null);
  }, [isOpen, lock]);

  useEffect(() => {
    if (screensaverActive && session) {
      lock("Locked when the screensaver started.");
    }
  }, [screensaverActive, session, lock]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activity restarts the countdown on every tap or key.
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () =>
        lock("Locked after 2 minutes without a tap. Enter a PIN to carry on."),
      APPROVALS_AUTO_LOCK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [session, activity, lock]);

  const unlock = async (approverMemberId: string, pin: string) => {
    const response = await openPending.mutateAsync({ approverMemberId, pin });
    setItems(response.data);
    setDecidedAny(false);
    setStatus(null);
    setLockNotice(null);
    setSession({
      approverMemberId,
      approverName:
        members.find((m) => m.id === approverMemberId)?.name ?? "a parent",
      pin,
    });
  };

  const decideOn = async (
    ids: string[],
    kind: "approve" | "reject",
    done: string,
  ) => {
    if (!session || busy || ids.length === 0) return;
    setBusy(true);
    const trimmed = reason.trim();
    try {
      await decide.mutateAsync({
        approverMemberId: session.approverMemberId,
        pin: session.pin,
        ...(kind === "approve"
          ? { approve: ids }
          : { reject: ids, ...(trimmed ? { reason: trimmed } : {}) }),
      });
      setItems((current) =>
        current.filter((item) => !ids.includes(item.completionId)),
      );
      setDecidedAny(true);
      setStatus(done);
      setRejectingId(null);
      setReason("");
    } catch (error) {
      // A refused PIN (say it was locked from another screen) ends the session.
      if (error instanceof ApiException && error.status === 403) {
        lock(error.message);
      } else {
        setStatus(
          error instanceof Error ? error.message : "That didn't go through.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Approve chores"
      initialHeight="full"
    >
      <div
        className="space-y-4 py-2"
        onPointerDown={touched}
        onKeyDown={touched}
      >
        {!session ? (
          <>
            {lockNotice && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {lockNotice}
              </p>
            )}
            <ParentPinPad
              prompt="Who is approving?"
              submitLabel="Open"
              onSubmit={unlock}
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Approving as {session.approverName}
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

            {status && (
              <p
                role="status"
                className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground"
              >
                {status}
              </p>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {decidedAny
                  ? "All caught up."
                  : "Nothing is waiting for a parent."}
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  className="h-12 w-full"
                  disabled={busy}
                  onClick={() =>
                    decideOn(
                      items.map((item) => item.completionId),
                      "approve",
                      `Approved ${chores(items.length)}.`,
                    )
                  }
                >
                  Approve all {items.length}
                </Button>
                <ul aria-label="Waiting for a parent" className="space-y-2">
                  {items.map((item) => {
                    const rejecting = rejectingId === item.completionId;
                    return (
                      <li
                        key={item.completionId}
                        className="space-y-3 rounded-xl border border-border bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {item.choreTitle}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.memberName} · ticked{" "}
                              {formatDateTimeInZone(item.completedAt, timeZone)}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-medium text-muted-foreground">
                            {pointsLabel(item)}
                          </span>
                        </div>
                        {rejecting ? (
                          <div className="space-y-2">
                            <Label htmlFor={`reason-${item.completionId}`}>
                              Reason (optional)
                            </Label>
                            <Input
                              id={`reason-${item.completionId}`}
                              value={reason}
                              maxLength={200}
                              placeholder="So they know what to fix"
                              onChange={(event) =>
                                setReason(event.target.value)
                              }
                              className="bg-input"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="destructive"
                                className="min-h-11 flex-1"
                                aria-label={`Reject ${item.choreTitle}`}
                                disabled={busy}
                                onClick={() =>
                                  decideOn(
                                    [item.completionId],
                                    "reject",
                                    `Rejected ${item.choreTitle} for ${item.memberName}.`,
                                  )
                                }
                              >
                                Reject
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="min-h-11"
                                onClick={() => {
                                  setRejectingId(null);
                                  setReason("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              className="min-h-11 flex-1"
                              disabled={busy}
                              onClick={() =>
                                decideOn(
                                  [item.completionId],
                                  "approve",
                                  `Approved ${item.choreTitle} for ${item.memberName}.`,
                                )
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 flex-1"
                              disabled={busy}
                              onClick={() => {
                                setRejectingId(item.completionId);
                                setReason("");
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </MobileSheet>
  );
}
