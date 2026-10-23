import { Users } from "lucide-react";
import { useFamilyMemberMap, useFamilyMembers } from "@/api";
import type {
  ChoreAssigneeGroup as ChoreAssigneeGroupData,
  ChoreBoardItem,
  ChoreScope,
} from "@/lib/types";
import { colorMap } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChoreRow } from "./chore-row";

interface ChoreAssigneeGroupProps {
  group: ChoreAssigneeGroupData;
  /** Forwarded to each row so a cadence the scope already implies is suppressed. */
  activeScope?: ChoreScope;
  onArchive?: (chore: ChoreBoardItem) => void;
  /** `completedByMemberId` is set when a chore for anyone was claimed by someone. */
  onComplete?: (chore: ChoreBoardItem, completedByMemberId?: string) => void;
  onUncomplete?: (chore: ChoreBoardItem) => void;
}

const ANYONE_HEADING_ID = "assignee-anyone";

/**
 * One member's chores for a scope, or the "Anyone" group (member null) that holds
 * unassigned chores. Rows in the Anyone group ask who did a chore before completing it.
 */
export function ChoreAssigneeGroup({
  group,
  activeScope,
  onArchive,
  onComplete,
  onUncomplete,
}: ChoreAssigneeGroupProps) {
  const familyMembers = useFamilyMembers();
  const memberMap = useFamilyMemberMap();
  const member = group.member;
  const headingId = member ? `assignee-${member.id}` : ANYONE_HEADING_ID;
  const name = member ? member.name : "Anyone";
  const barColor = member ? colorMap[member.color].bg : "bg-primary";
  const progressPercent =
    group.summary.total === 0
      ? 0
      : Math.round((group.summary.completed / group.summary.total) * 100);

  // "Done by" only when the credit went to someone other than the assignee.
  const completedByName = (chore: ChoreBoardItem): string | null => {
    const by = chore.completedByMemberId;
    if (!by || by === chore.assignedToMemberId) return null;
    return memberMap.get(by)?.name ?? null;
  };

  return (
    <section aria-labelledby={headingId}>
      <header className="mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              member
                ? `${colorMap[member.color].bg} text-white`
                : "bg-muted text-muted-foreground",
            )}
          >
            {member ? (
              member.name.charAt(0)
            ) : (
              <Users className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id={headingId}
              className="truncate text-base font-semibold text-foreground"
            >
              {name}
            </h3>
            <p className="text-xs font-medium text-muted-foreground">
              {group.summary.completed} of {group.summary.total} done
            </p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <div className="space-y-2">
        {group.chores.map((chore) => (
          <ChoreRow
            key={chore.templateId}
            chore={chore}
            activeScope={activeScope}
            members={member ? undefined : familyMembers}
            completedByName={completedByName(chore)}
            onArchive={() => onArchive?.(chore)}
            onComplete={(completedByMemberId) =>
              onComplete?.(chore, completedByMemberId)
            }
            onUncomplete={() => onUncomplete?.(chore)}
          />
        ))}
      </div>
    </section>
  );
}
