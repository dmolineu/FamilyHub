import { Archive, Check, Circle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";
import type {
  ChoreBoardItem,
  ChoreCadence,
  ChoreScope,
  DayOfWeek,
  FamilyMember,
} from "@/lib/types";
import { colorMap } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChoreRowProps {
  chore: ChoreBoardItem;
  /** Active scope tab. When it already implies the chore's cadence the label is
   * redundant (e.g. "Daily" inside the Today column) and is suppressed. */
  activeScope?: ChoreScope;
  /** Who may claim a chore that is for anyone; completing one asks among these. */
  members?: FamilyMember[];
  /** Shown as "Done by …" when someone other than the assignee got the credit. */
  completedByName?: string | null;
  onArchive?: () => void;
  /** `completedByMemberId` is set when the chore was for anyone and someone claimed it. */
  onComplete?: (completedByMemberId?: string) => void;
  onUncomplete?: () => void;
}

const SHORT_DAY: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

function cadenceLabel(chore: ChoreBoardItem): string {
  if (chore.cadence === "DAILY") return "Daily";
  if (chore.cadence === "WEEKLY") {
    // A weekly chore pinned to days reads "Mon · Thu" rather than "Weekly".
    return chore.daysOfWeek && chore.daysOfWeek.length > 0
      ? chore.daysOfWeek.map((day) => SHORT_DAY[day]).join(" · ")
      : "Weekly";
  }
  return "Monthly";
}

const IMPLIED_BY: Record<ChoreCadence, ChoreScope> = {
  DAILY: "TODAY",
  WEEKLY: "THIS_WEEK",
  MONTHLY: "THIS_MONTH",
};

export function ChoreRow({
  chore,
  activeScope,
  members,
  completedByName,
  onArchive,
  onComplete,
  onUncomplete,
}: ChoreRowProps) {
  const showCadence = IMPLIED_BY[chore.cadence] !== activeScope;
  // A kid's tick that a parent has not approved yet: done, but no points yet.
  const isPending = chore.completed && chore.status === "PENDING";
  const hasPoints = typeof chore.points === "number" && chore.points > 0;
  const isForAnyone = chore.assignedToMemberId === null;
  const [isChoosingMember, setChoosingMember] = useState(false);

  // Shared by the checkoff and the row-body button below, so both stay on the
  // same haptics path (success() on the completing transition only).
  const toggleCompletion = () => {
    if (chore.completed) {
      onUncomplete?.();
    } else if (isForAnyone && members && members.length > 0) {
      // Nobody is assigned, so the credit has to be claimed first.
      setChoosingMember(true);
    } else {
      haptics.success();
      onComplete?.();
    }
  };

  const claimFor = (memberId: string) => {
    setChoosingMember(false);
    haptics.success();
    onComplete?.(memberId);
  };

  return (
    <div
      data-testid={`chore-row-${chore.templateId}`}
      className={cn(
        "rounded-lg border transition-colors",
        chore.completed
          ? "border-border bg-muted/40"
          : "border-transparent bg-card hover:border-border",
      )}
    >
      <div className="flex min-h-14 items-center gap-3 p-3">
        {/*
        Keep this a raw <button>, not <Button>/usePressable (the Archive control
        beside it uses <Button>): a pressable would fire haptics.tap() on
        pointerdown, and the shared 40ms throttle would then coalesce away the
        haptics.success() pulse on click. The single completion pulse depends on
        no preceding tap. Guarded by the throttle-coupling test in haptics.test.ts.

        One control, not two: the indicator and the text share this button, the
        way ListItemRow's toggle does. A second sibling button over the text
        would need a distinct accessible name, and any static one ("Complete
        <title>") lies in the completed state, where activating it un-completes.
        Archive stays a sibling — nothing interactive nests here.
      */}
        <button
          type="button"
          aria-label={
            chore.completed
              ? `Mark ${chore.title} incomplete`
              : `Mark ${chore.title} complete`
          }
          onClick={toggleCompletion}
          className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          {/* group-hover, not hover: the indicator is no longer the hovered
            element, so the affordance has to come from the button. */}
          <span
            data-testid="chore-checkoff"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              chore.completed
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground group-hover:border-primary group-hover:text-primary",
            )}
          >
            {chore.completed ? (
              <Check className="h-5 w-5" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col">
            <span
              data-testid="chore-title"
              className={cn(
                "truncate text-sm font-semibold text-foreground",
                chore.completed && "text-muted-foreground line-through",
              )}
            >
              {chore.title}
            </span>
            {(chore.completed && completedByName) ||
            showCadence ||
            isPending ||
            hasPoints ? (
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                {chore.completed && completedByName ? (
                  <span>Done by {completedByName}</span>
                ) : (
                  showCadence && <span>{cadenceLabel(chore)}</span>
                )}
                {isPending && (
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    Waiting for a parent
                  </span>
                )}
                {hasPoints && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                    {chore.points} pts
                  </span>
                )}
              </span>
            ) : null}
          </span>
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={`Archive ${chore.title}`}
          onClick={onArchive}
          className="text-muted-foreground hover:text-foreground"
        >
          <Archive className="h-4 w-4" />
        </Button>
      </div>

      {isChoosingMember && members && (
        // A fieldset is the semantic group here; its legend names it for AT and tests.
        <fieldset className="m-0 border-0 p-0 px-3 pb-3">
          <legend className="sr-only">Who completed {chore.title}?</legend>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Who did it?
            </span>
            {members.map((member) => {
              const colors = colorMap[member.color];
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => claimFor(member.id)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all hover:opacity-80",
                    colors?.light,
                    colors?.text,
                  )}
                >
                  <span className={cn("h-3 w-3 rounded-full", colors?.bg)} />
                  {member.name}
                </button>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChoosingMember(false)}
            >
              Cancel
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

export type { ChoreRowProps };
