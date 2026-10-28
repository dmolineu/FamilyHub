/** The leagues a family can follow teams in (men's college sports only). */
export type SportsLeague =
  | "NFL"
  | "MLB"
  | "COLLEGE_FOOTBALL"
  | "MENS_COLLEGE_BASKETBALL";

/** A league, and whether the server has a data source for it yet. */
export interface SportsLeagueInfo {
  league: SportsLeague;
  name: string;
  available: boolean;
}

/** A team as the league's data source lists it. */
export interface ProviderTeam {
  id: string;
  name: string;
  shortName: string | null;
  abbreviation: string | null;
  logoUrl: string | null;
}

/** A team the family follows. */
export interface FollowedTeam {
  id: string;
  league: SportsLeague;
  providerTeamId: string;
  name: string;
  shortName: string | null;
  abbreviation: string | null;
  logoUrl: string | null;
  /** #rrggbb, or null for the neutral colour. */
  color: string | null;
  showOnCalendar: boolean;
  hideScores: boolean;
  /** Fans: the members whose lanes show the team's games. */
  memberIds: string[];
}

export interface FollowedTeamUpdate {
  memberIds?: string[];
  color?: string;
  showOnCalendar?: boolean;
  hideScores?: boolean;
}

export type GameState =
  | "SCHEDULED"
  | "LIVE"
  | "FINAL"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED";

export interface GameSideInfo {
  teamId: string;
  name: string;
  abbreviation: string | null;
  score: number | null;
  /** Only for a followed team. */
  logoUrl: string | null;
}

/** A followed team's game, read-only. */
export interface SportsGame {
  id: string;
  providerGameId: string;
  league: SportsLeague;
  /** ISO instant. */
  startAt: string;
  /** The start time is a placeholder: show "time TBA". */
  timeTbd: boolean;
  home: GameSideInfo;
  away: GameSideInfo;
  venue: string | null;
  broadcasts: string[];
  state: GameState;
  /** "Top 5th", "Final/10", "Postponed: Rain"; null before a game. */
  detail: string | null;
  followedTeamIds: string[];
  color: string | null;
  memberIds: string[];
  /** A followed team in this game hides its scores until someone reveals them here. */
  hideScores: boolean;
}

/** The live panel's details for one game. */
export interface GameSummary {
  gameId: string;
  detail: string | null;
  lines: { abbreviation: string; stats: { label: string; value: string }[] }[];
  situation: string[];
  leaders: { label: string; name: string; line: string }[];
}
