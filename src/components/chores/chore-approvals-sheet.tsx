import { useEffect, useState } from "react";
import {
  useDecideChoreApprovals,
  useFamilyData,
  usePendingChoreApprovals,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import { formatTimeInZone } from "@/lib/chore-times";
import type { PendingChoreApproval } from "@/lib/types";
import { ParentPinPad } from "./parent-pin-pad";

interface ChoreApprovalsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type Decision = "approve" | "reject";

function chores(count: number): string {
  return `${count} chore${count === 1 ? "" : "s"}`;
}

function pointsLabel(item: PendingChoreApproval): string {
  if (item.points === null) return "No points set";
  return `${item.points} point${item.points === 1 ? "" : "s"}`;
}

/**
 * Kids' ticked chores waiting for a parent. Everything starts selected, so the
 * usual case (approve the lot) is two taps and a PIN; untick any to leave them
 * waiting, or reject them instead, which unticks them so they can be redone.
 */
export function ChoreApprovalsSheet({
  isOpen,
  onClose,
}: ChoreApprovalsSheetProps) {
  const pending = usePendingChoreApprovals(isOpen);
  const decide = useDecideChoreApprovals();
  const timeZone = useFamilyData()?.timezone;
  // Track what was unticked, so chores arriving while the sheet is open start selected.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSkipped(new Set());
      setDecision(null);
      setReason("");
      setResult(null);
    }
  }, [isOpen]);

  const items = pending.data ?? [];
  const chosen = items.filter((item) => !skipped.has(item.completionId));

  const toggle = (id: string) => {
    setResult(null);
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (approverMemberId: string, pin: string) => {
    const ids = chosen.map((item) => item.completionId);
    const trimmed = reason.trim();
    const response = await decide.mutateAsync({
      approverMemberId,
      pin,
      ...(decision === "approve" ? { approve: ids } : { reject: ids }),
      ...(decision === "reject" && trimmed ? { reason: trimmed } : {}),
    });
    const { approved, rejected } = response.data;
    setResult(
      decision === "approve"
        ? `Approved ${chores(approved)}.`
        : `Rejected ${chores(rejected)}.`,
    );
    setDecision(null);
    setReason("");
    setSkipped(new Set());
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Approve chores"
      initialHeight="full"
    >
      <div className="space-y-4 py-2">
        {result && (
          <p
            role="status"
            className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground"
          >
            {result}
          </p>
        )}

        {decision ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {decision === "approve" ? "Approve" : "Reject"}{" "}
                {chores(chosen.length)}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => setDecision(null)}
              >
                Back to the list
              </Button>
            </div>
            {decision === "reject" && (
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Reason (optional)</Label>
                <Input
                  id="reject-reason"
                  value={reason}
                  maxLength={200}
                  placeholder="So they know what to fix"
                  onChange={(event) => setReason(event.target.value)}
                  className="bg-input"
                />
              </div>
            )}
            <ParentPinPad
              prompt={
                decision === "approve"
                  ? "Who is approving?"
                  : "Who is rejecting these?"
              }
              submitLabel={`${decision === "approve" ? "Approve" : "Reject"} ${chores(chosen.length)}`}
              onSubmit={submit}
            />
          </div>
        ) : (
          <>
            {pending.isLoading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {pending.isError && (
              <p className="text-sm text-destructive">
                The chores waiting for a parent could not be loaded.
              </p>
            )}
            {!pending.isLoading && !pending.isError && items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing is waiting for a parent.
              </p>
            )}
            {items.length > 0 && (
              <>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item.completionId}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3">
                        <input
                          type="checkbox"
                          className="h-6 w-6 shrink-0 accent-primary"
                          checked={!skipped.has(item.completionId)}
                          onChange={() => toggle(item.completionId)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-foreground">
                            {item.choreTitle}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {item.memberName} ·{" "}
                            {formatTimeInZone(item.completedAt, timeZone)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-muted-foreground">
                          {pointsLabel(item)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    className="h-12 flex-1"
                    disabled={chosen.length === 0}
                    onClick={() => {
                      setResult(null);
                      setDecision("approve");
                    }}
                  >
                    Approve {chosen.length}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1"
                    disabled={chosen.length === 0}
                    onClick={() => {
                      setResult(null);
                      setDecision("reject");
                    }}
                  >
                    Reject {chosen.length}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </MobileSheet>
  );
}
