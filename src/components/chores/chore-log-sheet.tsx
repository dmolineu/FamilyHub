import { useEffect, useMemo, useState } from "react";
import { useChoreActivity, useChorePoints, useFamilyData } from "@/api";
import { Button } from "@/components/ui/button";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import {
  dayKeyInZone,
  formatDayInZone,
  formatTimeInZone,
  parseServerInstant,
} from "@/lib/chore-times";
import type { ChoreActivityEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ParentPinPad } from "./parent-pin-pad";

interface ChoreLogSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type Range = "7" | "30" | "all";

const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All" },
];

function describe(entry: ChoreActivityEntry): string {
  const actor = entry.actorName ?? "a parent";
  switch (entry.kind) {
    case "COMPLETED":
      return entry.points > 0 ? "Ticked off, counted at once" : "Ticked off";
    case "APPROVED":
      return `Approved by ${actor}`;
    case "REJECTED":
      return `Rejected by ${actor}${entry.reason ? `: ${entry.reason}` : ""}`;
    case "UNCOMPLETED":
      return "Unticked";
    case "REVERSED":
      return entry.actorName
        ? `Points taken back by ${entry.actorName}`
        : "Unticked, points taken back";
    case "REDEEMED":
      return `Reward approved by ${actor}`;
    case "DECLINED":
      return `Reward declined by ${actor}${entry.reason ? `: ${entry.reason}` : ""}`;
  }
}

function signedPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

/**
 * Every tick, approval, rejection and reversal, newest first, behind a parent's
 * PIN. The entries live only in this component's state and are dropped when the
 * sheet closes, so the next person at the wall needs a PIN again.
 */
export function ChoreLogSheet({ isOpen, onClose }: ChoreLogSheetProps) {
  const activity = useChoreActivity();
  const timeZone = useFamilyData()?.timezone;
  const [entries, setEntries] = useState<ChoreActivityEntry[] | null>(null);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("all");
  const unlocked = entries !== null;
  const points = useChorePoints();

  useEffect(() => {
    if (!isOpen) {
      setEntries(null);
      setMemberFilter(null);
      setRange("all");
    }
  }, [isOpen]);

  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of entries ?? []) {
      if (entry.memberId && !seen.has(entry.memberId)) {
        seen.set(entry.memberId, entry.memberName);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [entries]);

  const visible = useMemo(() => {
    const cutoff =
      range === "all" ? null : Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    return (entries ?? []).filter(
      (entry) =>
        (memberFilter === null || entry.memberId === memberFilter) &&
        (cutoff === null ||
          parseServerInstant(entry.occurredAt).getTime() >= cutoff),
    );
  }, [entries, memberFilter, range]);

  const days = useMemo(() => {
    const groups: Array<{
      key: string;
      label: string;
      items: ChoreActivityEntry[];
    }> = [];
    for (const entry of visible) {
      const key = dayKeyInZone(entry.occurredAt, timeZone);
      const last = groups[groups.length - 1];
      if (last?.key === key) {
        last.items.push(entry);
      } else {
        groups.push({
          key,
          label: formatDayInZone(entry.occurredAt, timeZone),
          items: [entry],
        });
      }
    }
    return groups;
  }, [visible, timeZone]);

  const kids = (points.data ?? []).filter((p) => p.role === "KID");

  const unlock = async (approverMemberId: string, pin: string) => {
    const response = await activity.mutateAsync({ approverMemberId, pin });
    setEntries(response.data);
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Chore log"
      initialHeight="full"
    >
      <div className="space-y-4 py-2">
        {!unlocked ? (
          <ParentPinPad
            prompt="Who is opening the log?"
            submitLabel="Open log"
            onSubmit={unlock}
          />
        ) : (
          <>
            {kids.length > 0 && (
              <section aria-label="Points" className="flex flex-wrap gap-2">
                {kids.map((kid) => (
                  <div
                    key={kid.memberId}
                    className="flex items-baseline gap-2 rounded-xl border border-border bg-card px-3 py-2"
                  >
                    <span className="font-semibold text-foreground">
                      {kid.memberName}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {kid.points} point{kid.points === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </section>
            )}

            <div className="flex flex-wrap gap-2">
              {[{ id: null, name: "Everyone" }, ...people].map((person) => (
                <Button
                  key={person.id ?? "everyone"}
                  type="button"
                  size="sm"
                  className="min-h-11"
                  variant={memberFilter === person.id ? "default" : "outline"}
                  aria-pressed={memberFilter === person.id}
                  onClick={() => setMemberFilter(person.id)}
                >
                  {person.name}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {RANGES.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  className="min-h-11"
                  variant={range === option.value ? "secondary" : "ghost"}
                  aria-pressed={range === option.value}
                  onClick={() => setRange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing in the log for this selection yet.
              </p>
            ) : (
              days.map((day) => (
                <section
                  key={day.key}
                  aria-label={day.label}
                  className="space-y-2"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {day.label}
                  </h3>
                  <ol className="space-y-2">
                    {day.items.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {entry.memberName} · {entry.choreTitle}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {describe(entry)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {entry.points !== 0 && (
                            <p
                              className={cn(
                                "font-semibold",
                                entry.points > 0
                                  ? "text-foreground"
                                  : "text-destructive",
                              )}
                            >
                              {signedPoints(entry.points)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatTimeInZone(entry.occurredAt, timeZone)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </MobileSheet>
  );
}
