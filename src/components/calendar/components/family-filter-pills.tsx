import { Check, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useFamilyMembers, useFollowedTeams } from "@/api";
import { MemberAvatar } from "@/components/calendar/components/member-avatar";
import { parseAvatar } from "@/lib/avatars";
import { memberColor } from "@/lib/member-color";
import { cn } from "@/lib/utils";
import { useFilterPillsState } from "@/stores";
import { useSportsStore } from "@/stores/sports-store";

export function FamilyFilterPills() {
  const familyMembers = useFamilyMembers();
  const followsAnyTeam = (useFollowedTeams().data?.length ?? 0) > 0;
  const hideSports = useSportsStore((s) => s.hideSports);
  const setHideSports = useSportsStore((s) => s.setHideSports);

  // Compound selector with shallow comparison (4 separate calls → 1)
  const {
    filter,
    toggleMember,
    toggleAllMembers,
    toggleAllDayEvents,
    initializeSelectedMembers,
  } = useFilterPillsState();

  // Initialize selected members on first load or when persisted filter is stale
  useEffect(() => {
    if (familyMembers.length === 0) return;

    const currentMemberIds = familyMembers.map((m) => m.id);

    // Check if any selected member still exists in the actual family
    const hasValidSelection = filter.selectedMembers.some((id) =>
      currentMemberIds.includes(id),
    );

    if (filter.selectedMembers.length === 0 || !hasValidSelection) {
      // First load or all selected members are stale → select all
      initializeSelectedMembers(currentMemberIds);
    }
  }, [familyMembers, filter.selectedMembers, initializeSelectedMembers]);

  const allSelected = filter.selectedMembers.length === familyMembers.length;
  const noneSelected = filter.selectedMembers.length === 0;

  const handleToggleAll = () => {
    toggleAllMembers(familyMembers.map((m) => m.id));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-testid="family-filter-pills"
    >
      <button
        onClick={handleToggleAll}
        className={cn(
          "flex min-h-11 min-w-11 items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
          allSelected
            ? "bg-foreground text-background border-foreground"
            : noneSelected
              ? "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80",
        )}
      >
        {allSelected ? "All" : noneSelected ? "None" : "Some"}
      </button>

      <button
        onClick={toggleAllDayEvents}
        className={cn(
          "flex min-h-11 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
          filter.showAllDayEvents
            ? "bg-primary/10 text-primary border-primary/30"
            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
        )}
      >
        <span className="text-[10px] font-bold">24h</span>
        <span className="hidden sm:inline">All Day</span>
        {filter.showAllDayEvents && <Check className="h-3 w-3" />}
      </button>

      {followsAnyTeam && (
        <button
          type="button"
          aria-pressed={!hideSports}
          aria-label="Sports"
          onClick={() => setHideSports(!hideSports)}
          className={cn(
            "flex min-h-11 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
            !hideSports
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
          )}
        >
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Sports</span>
          {!hideSports && <Check className="h-3 w-3" aria-hidden="true" />}
        </button>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      {familyMembers.map((member) => {
        const colors = memberColor(member.color);
        const isSelected = filter.selectedMembers.includes(member.id);

        return (
          <button
            key={member.id}
            onClick={() => toggleMember(member.id)}
            className={cn(
              "flex min-h-11 items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all",
              isSelected
                ? `${colors?.bg} text-white shadow-sm`
                : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-50",
            )}
            title={member.name}
            aria-label={`Filter by ${member.name}`}
          >
            {parseAvatar(member.avatarUrl).kind === "initials" ? (
              <span
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold",
                  isSelected ? "bg-white/20" : colors?.bg,
                  !isSelected && "text-white",
                )}
              >
                {member.name.charAt(0)}
              </span>
            ) : (
              <MemberAvatar
                name={member.name}
                color={member.color}
                avatarUrl={member.avatarUrl}
                className="h-6 w-6 ring-1 ring-white/70"
              />
            )}
            <span className="hidden sm:inline">{member.name}</span>
          </button>
        );
      })}
    </div>
  );
}
