import { useRef } from "react";
import { memberColor } from "@/lib/member-color";
import type { FamilyMember } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The people chosen after tapping one (Phase 4: an event can be for several). A tap adds
 * someone after the others or removes them; removing the lead makes the next one lead.
 * The last person cannot be removed, so an event is always for someone. With `replace`,
 * the tap picks only that person: used while the form's pick is still its own guess.
 */
export function toggleMember(
  selected: string[],
  id: string,
  { replace = false }: { replace?: boolean } = {},
): string[] {
  if (replace) return [id];
  if (!selected.includes(id)) return [...selected, id];
  return selected.length === 1
    ? selected
    : selected.filter((chosen) => chosen !== id);
}

interface MemberMultiSelectorProps {
  members: FamilyMember[];
  /** The chosen people, the lead first. */
  value: string[];
  onChange: (memberIds: string[]) => void;
  error?: boolean;
  /**
   * The value is a guess (a new event's default person): the first tap replaces it,
   * so a one-person event is still one tap. Later taps add and remove.
   */
  replaceUntilTouched?: boolean;
  className?: string;
}

/**
 * The family's people as toggles, for an event that can be for several of them. Looks
 * like the one-person {@link MemberSelector} so the form does not change shape.
 */
export function MemberMultiSelector({
  members,
  value,
  onChange,
  error = false,
  replaceUntilTouched = false,
  className,
}: MemberMultiSelectorProps) {
  const touched = useRef(false);

  const handleTap = (id: string) => {
    const replace = replaceUntilTouched && !touched.current;
    touched.current = true;
    onChange(toggleMember(value, id, { replace }));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        error && "ring-1 ring-destructive/50 rounded-lg p-1",
        className,
      )}
    >
      {members.map((member) => {
        const colors = memberColor(member.color);
        const isSelected = value.includes(member.id);

        return (
          <button
            key={member.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => handleTap(member.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all",
              isSelected
                ? `${colors?.bg} text-white`
                : `${colors?.light} ${colors?.text} hover:opacity-80`,
            )}
          >
            <div
              className={cn(
                "w-3 h-3 rounded-full",
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
