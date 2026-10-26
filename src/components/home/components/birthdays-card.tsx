import { Cake, PartyPopper } from "lucide-react";
import { useFamilyData, useFamilyMembers } from "@/api";
import {
  countdownLabel,
  todayInZone,
  upcomingBirthdays,
} from "@/lib/birthdays";
import { cn } from "@/lib/utils";

/** How far ahead Home looks for birthdays. */
const WINDOW_DAYS = 30;

/**
 * Home's birthday corner: a greeting for anyone whose birthday is today, then the
 * birthdays in the next 30 days with a countdown, computed in the family's zone.
 * Renders nothing when no birthday is near.
 */
export function BirthdaysCard({ className }: { className?: string }) {
  const members = useFamilyMembers();
  const timeZone =
    useFamilyData()?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const upcoming = upcomingBirthdays(
    members,
    todayInZone(new Date(), timeZone),
    WINDOW_DAYS,
  );
  if (upcoming.length === 0) return null;

  const today = upcoming.filter((b) => b.daysUntil === 0);
  const later = upcoming.filter((b) => b.daysUntil > 0);

  return (
    <section
      aria-label="Birthdays"
      className={cn("rounded-xl border border-border bg-card p-4", className)}
    >
      {today.map(({ member, turning }) => (
        <div
          key={member.id}
          className="mb-3 flex items-center gap-3 rounded-lg bg-primary/10 p-3 motion-safe:animate-home-breathing-pulse last:mb-0"
        >
          <PartyPopper className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Happy birthday, {member.name}!
            </h3>
            {turning ? (
              <p className="text-sm text-muted-foreground">
                {member.name} turns {turning} today
              </p>
            ) : null}
          </div>
        </div>
      ))}
      {later.length > 0 && (
        <>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Cake className="h-4 w-4" />
            Coming up
          </p>
          <ul className="space-y-1">
            {later.map(({ member, daysUntil, turning }) => (
              <li
                key={member.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  {turning ? `${member.name} turns ${turning}` : member.name}
                  <span className="sr-only"> · </span>
                </span>
                <span className="text-muted-foreground">
                  {countdownLabel(daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
