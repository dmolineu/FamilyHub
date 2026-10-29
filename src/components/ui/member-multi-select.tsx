import { Users } from "lucide-react";
import { memberColor } from "@/lib/member-color";
import type { FamilyMember } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MemberMultiSelectProps {
  members: FamilyMember[];
  /** Selected member ids; empty means "anyone". */
  value: string[];
  onChange: (memberIds: string[]) => void;
  /** Label of the empty-selection chip. */
  anyoneLabel?: string;
  className?: string;
}

const CHIP_CLASS =
  "flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all";

/**
 * Toggleable member chips plus an "anyone" chip. Clicking a member adds or removes
 * them; clicking "anyone" clears the selection. Each chip is a toggle button, so
 * `aria-pressed` carries the state for assistive tech and tests.
 */
function MemberMultiSelect({
  members,
  value,
  onChange,
  anyoneLabel = "Anyone",
  className,
}: MemberMultiSelectProps) {
  const anyoneSelected = value.length === 0;

  const toggle = (memberId: string) => {
    onChange(
      value.includes(memberId)
        ? value.filter((id) => id !== memberId)
        : [...value, memberId],
    );
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        aria-pressed={anyoneSelected}
        onClick={() => onChange([])}
        className={cn(
          CHIP_CLASS,
          anyoneSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:opacity-80",
        )}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        {anyoneLabel}
      </button>
      {members.map((member) => {
        const colors = memberColor(member.color);
        const isSelected = value.includes(member.id);

        return (
          <button
            key={member.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(member.id)}
            className={cn(
              CHIP_CLASS,
              isSelected
                ? `${colors?.bg} text-white`
                : `${colors?.light} ${colors?.text} hover:opacity-80`,
            )}
          >
            <span
              className={cn(
                "h-3 w-3 rounded-full",
                isSelected ? "bg-white/90" : colors?.bg,
              )}
            />
            {member.name}
          </button>
        );
      })}
    </div>
  );
}

export type { MemberMultiSelectProps };
export { MemberMultiSelect };
