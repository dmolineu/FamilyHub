import { parseLocalDate } from "./time-utils";
import type {
  CalendarEvent,
  FollowedTeam,
  GameSideInfo,
  SportsGame,
} from "./types";

/** How long a game is shown as lasting; providers give a start time only. */
const GAME_LENGTH_MS = 3 * 60 * 60 * 1000;

function zoned(instant: Date, timeZone: string | undefined) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`,
  };
}

function shortName(
  side: GameSideInfo,
  followed: FollowedTeam[],
): string | null {
  const team = followed.find((t) => t.providerTeamId === side.teamId);
  return team ? (team.shortName ?? team.name) : null;
}

/** "1:10 PM": when a game starts, in the family's time zone. */
export function gameStartTime(game: SportsGame, timeZone?: string): string {
  return zoned(new Date(game.startAt), timeZone).time;
}

/** "Padres vs Los Angeles Dodgers" from the followed team's side. */
export function gameMatchup(
  game: SportsGame,
  followed: FollowedTeam[],
): string {
  const leagueTeams = followed.filter((t) => t.league === game.league);
  const home = shortName(game.home, leagueTeams);
  const away = shortName(game.away, leagueTeams);
  if (home && away) return `${away} at ${home}`;
  if (home) return `${home} vs ${game.away.name}`;
  if (away) return `${away} at ${game.home.name}`;
  return `${game.away.name} at ${game.home.name}`;
}

/** "LAD 1, SD 2": away first, as scores are read out. */
export function gameScore(game: SportsGame): string {
  const label = (side: GameSideInfo) => side.abbreviation ?? side.name;
  return `${label(game.away)} ${game.away.score ?? 0}, ${label(game.home)} ${game.home.score ?? 0}`;
}

/** Whether this device may show the game's score. */
export function scoreVisible(
  game: SportsGame,
  revealedIds: ReadonlySet<string>,
): boolean {
  return !game.hideScores || revealedIds.has(game.id);
}

function status(game: SportsGame, revealedIds: ReadonlySet<string>): string {
  switch (game.state) {
    case "LIVE":
      if (!scoreVisible(game, revealedIds)) return " · Live";
      return ` · ${gameScore(game)}${game.detail ? ` · ${game.detail}` : ""}`;
    case "FINAL":
      if (!scoreVisible(game, revealedIds)) return " · Final";
      return ` · ${gameScore(game)} · ${game.detail ?? "Final"}`;
    case "POSTPONED":
    case "CANCELLED":
    case "SUSPENDED":
      return ` · ${game.detail ?? game.state.toLowerCase()}`;
    default:
      return "";
  }
}

/**
 * Followed teams' games as read-only calendar entries, in every fan's lane. Times are
 * the family's; a game without a set time is all-day, "time TBA". Scores show in the
 * title once a game starts, unless its team hides them and this device has not
 * revealed this game.
 */
export function sportsGameEvents(
  games: SportsGame[],
  followed: FollowedTeam[],
  revealedIds: ReadonlySet<string>,
  timeZone?: string,
): CalendarEvent[] {
  return games.map((game) => {
    const start = new Date(game.startAt);
    const begins = zoned(start, timeZone);
    const ends = zoned(new Date(start.getTime() + GAME_LENGTH_MS), timeZone);
    return {
      id: `sports:${game.id}`,
      title: `${gameMatchup(game, followed)}${game.timeTbd ? " (time TBA)" : ""}${status(game, revealedIds)}`,
      startTime: game.timeTbd ? "12:00 AM" : begins.time,
      endTime: game.timeTbd || ends.iso !== begins.iso ? "11:59 PM" : ends.time,
      date: parseLocalDate(begins.iso),
      memberId: game.memberIds[0] ?? "",
      memberIds: game.memberIds,
      isAllDay: game.timeTbd,
      location: game.venue ?? undefined,
      description:
        game.broadcasts.length > 0
          ? `On ${game.broadcasts.join(", ")}`
          : undefined,
      source: "SPORTS",
    };
  });
}
