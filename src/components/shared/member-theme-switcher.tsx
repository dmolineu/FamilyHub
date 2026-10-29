import { useFamilyMembers } from "@/api";
import { MemberAvatar } from "@/components/calendar/components/member-avatar";
import { useShowMemberTheme } from "@/hooks/use-member-theme";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

/**
 * The family's faces in the header. Tapping one shows that person's own theme
 * on this screen (someone without one brings back the screen's own look) until
 * the screen goes untouched for the family's revert time, or another tap or a
 * new screen look changes it. Only this screen changes; the person showing is
 * ringed. Each face is a full 44 px target for fingers at the wall.
 */
export function MemberThemeSwitcher({ className }: { className?: string }) {
  const members = useFamilyMembers();
  const personId = useThemeStore((s) => s.person?.memberId ?? null);
  const show = useShowMemberTheme();

  if (members.length === 0) return null;

  return (
    <fieldset
      aria-label="Show someone's theme"
      className={cn("m-0 flex shrink-0 items-center border-0 p-0", className)}
    >
      {members.slice(0, 6).map((member) => {
        const active = member.id === personId;
        return (
          <button
            key={member.id}
            type="button"
            title={member.name}
            aria-label={`Show ${member.name}'s theme`}
            aria-pressed={active}
            onClick={() => void show(member)}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-80"
          >
            <MemberAvatar
              name={member.name}
              color={member.color}
              avatarUrl={member.avatarUrl}
              className={cn(
                "h-8 w-8 text-sm font-normal",
                active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
            />
          </button>
        );
      })}
    </fieldset>
  );
}
