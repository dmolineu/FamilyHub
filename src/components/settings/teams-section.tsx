import { Check, Plus, Search, X } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";
import {
  useFamilyMembers,
  useFollowedTeams,
  useFollowTeam,
  useSportsLeagues,
  useTeamSearch,
  useUnfollowTeam,
  useUpdateFollowedTeam,
} from "@/api";
import { MemberAvatar } from "@/components/calendar/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  colorMap,
  type FamilyColor,
  type FollowedTeam,
  type SportsLeague,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = Object.keys(colorMap) as FamilyColor[];

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function TeamLogo({
  url,
  className,
}: {
  url: string | null;
  className?: string;
}) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className={cn("h-8 w-8 shrink-0 object-contain", className)}
    />
  );
}

/** One followed team: its fans, colour and switches. */
function FollowedTeamCard({ team }: { team: FollowedTeam }) {
  const members = useFamilyMembers();
  const update = useUpdateFollowedTeam();
  const unfollow = useUnfollowTeam();
  const [confirming, setConfirming] = useState(false);
  const label = team.shortName ?? team.name;

  const toggleFan = (memberId: string) => {
    const memberIds = team.memberIds.includes(memberId)
      ? team.memberIds.filter((id) => id !== memberId)
      : [...team.memberIds, memberId];
    update.mutate({ id: team.id, memberIds });
  };

  return (
    <li
      aria-label={team.name}
      className="space-y-3 rounded-xl border border-border bg-card p-3"
    >
      <div className="flex items-center gap-3">
        <TeamLogo url={team.logoUrl} />
        <p className="min-w-0 flex-1 truncate font-semibold">{team.name}</p>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => setConfirming(true)}
        >
          Unfollow
        </Button>
      </div>

      {confirming && (
        <div className="space-y-2 rounded-md bg-muted p-3">
          <p className="text-sm">
            Unfollow the {label}? Their games leave the calendar.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={() => setConfirming(false)}
            >
              Keep them
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 flex-1"
              aria-label={`Unfollow the ${label}`}
              disabled={unfollow.isPending}
              onClick={() => unfollow.mutate(team.id)}
            >
              Unfollow
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Fans (their lanes show the games)
        </p>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const fan = team.memberIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={fan}
                aria-label={`${member.name} is a fan`}
                onClick={() => toggleFan(member.id)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-2 pr-3 text-sm",
                  fan
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                <MemberAvatar
                  name={member.name}
                  color={member.color}
                  avatarUrl={member.avatarUrl}
                  className="h-7 w-7 text-xs"
                />
                {member.name}
                {fan && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Colour on the calendar
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-label="No colour"
            aria-pressed={team.color === null}
            onClick={() => update.mutate({ id: team.id, color: "" })}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border",
              team.color === null ? "ring-2 ring-primary" : "border-border",
            )}
          >
            <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
          {COLORS.map((color) => {
            const hex = colorMap[color].hex.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                aria-label={capitalise(color)}
                aria-pressed={team.color === hex}
                onClick={() => update.mutate({ id: team.id, color: hex })}
                className={cn(
                  "h-11 w-11 rounded-full border-2",
                  team.color === hex
                    ? "border-foreground ring-2 ring-primary"
                    : "border-transparent",
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-border">
        <Label className="flex min-h-11 items-center justify-between gap-3 py-1">
          Show on calendar
          <Switch
            aria-label="Show on calendar"
            checked={team.showOnCalendar}
            onCheckedChange={(on) =>
              update.mutate({ id: team.id, showOnCalendar: on })
            }
          />
        </Label>
        <Label className="flex min-h-11 items-center justify-between gap-3 py-1">
          <span>
            Hide scores
            <span className="block text-xs font-normal text-muted-foreground">
              Each device shows "Score hidden" until someone taps to reveal it.
            </span>
          </span>
          <Switch
            aria-label="Hide scores"
            checked={team.hideScores}
            onCheckedChange={(on) =>
              update.mutate({ id: team.id, hideScores: on })
            }
          />
        </Label>
      </div>
    </li>
  );
}

/** Finding a team in a league and following it. */
function FollowPanel({ onClose }: { onClose: () => void }) {
  const leagues = useSportsLeagues().data ?? [];
  const followed = useFollowedTeams().data ?? [];
  const follow = useFollowTeam();
  const [chosen, setChosen] = useState<SportsLeague | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const baseId = useId();

  const league =
    chosen ?? leagues.find((l) => l.available)?.league ?? leagues[0]?.league;
  const info = leagues.find((l) => l.league === league);
  const results = useTeamSearch(
    info?.available ? (league ?? null) : null,
    deferredQuery,
  );

  return (
    <div className="space-y-3 rounded-xl border border-primary/40 p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Follow a team</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div
        role="tablist"
        aria-label="League"
        className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-4"
      >
        {leagues.map((l) => (
          <button
            key={l.league}
            type="button"
            role="tab"
            aria-selected={l.league === league}
            aria-controls={`${baseId}-panel`}
            onClick={() => {
              setChosen(l.league);
              setQuery("");
            }}
            className={cn(
              "min-h-11 rounded-lg px-2 text-sm font-medium",
              l.league === league
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" className="space-y-2">
        {info && !info.available ? (
          <p className="text-sm text-muted-foreground">
            There is no data source for {info.name} scores yet; they arrive with
            a later update.
          </p>
        ) : (
          info && (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  aria-label={`Search ${info.name} teams`}
                  value={query}
                  placeholder="Team or city"
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 bg-input pl-9"
                />
              </div>
              <ul
                aria-label={`${info.name} teams`}
                className="max-h-72 space-y-1 overflow-y-auto overscroll-contain"
              >
                {(results.data ?? []).map((team) => {
                  const already = followed.some(
                    (f) => f.league === league && f.providerTeamId === team.id,
                  );
                  return (
                    <li key={team.id} className="flex items-center gap-3 py-1">
                      <TeamLogo url={team.logoUrl} className="h-7 w-7" />
                      <span className="min-w-0 flex-1 truncate">
                        {team.name}
                      </span>
                      <Button
                        type="button"
                        variant={already ? "ghost" : "outline"}
                        className="min-h-11"
                        aria-label={
                          already
                            ? `Following ${team.name}`
                            : `Follow ${team.name}`
                        }
                        disabled={already || follow.isPending}
                        onClick={() =>
                          league &&
                          follow.mutate({ league, providerTeamId: team.id })
                        }
                      >
                        {already ? "Following" : "Follow"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {follow.error && (
                <p role="alert" className="text-sm text-destructive">
                  {follow.error.message}
                </p>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

/**
 * Family Settings: the teams the family follows. Their games go on the calendar in
 * the fans' lanes (never into Google Calendar), with live scores while they play.
 */
export function TeamsSection() {
  const teams = useFollowedTeams();
  const [adding, setAdding] = useState(false);
  const list = teams.data ?? [];

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Teams
        </h3>
        <p className="text-sm text-muted-foreground">
          Follow teams to put their games on the calendar, with live scores
          while they play.
        </p>
      </div>

      {teams.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The family is not following any teams yet.
        </p>
      ) : (
        <ul aria-label="Followed teams" className="space-y-3">
          {list.map((team) => (
            <FollowedTeamCard key={team.id} team={team} />
          ))}
        </ul>
      )}

      {adding ? (
        <FollowPanel onClose={() => setAdding(false)} />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Follow a team
        </Button>
      )}
    </section>
  );
}
