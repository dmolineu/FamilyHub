import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { sportsService } from "@/api/services/sports.service";
import type {
  ApiResponse,
  FollowedTeam,
  FollowedTeamUpdate,
  GameSummary,
  ProviderTeam,
  SportsGame,
  SportsLeague,
  SportsLeagueInfo,
} from "@/lib/types";

export const sportsKeys = {
  all: ["sports"] as const,
  leagues: () => [...sportsKeys.all, "leagues"] as const,
  search: (league: SportsLeague, query: string) =>
    [...sportsKeys.all, "search", league, query] as const,
  teams: () => [...sportsKeys.all, "teams"] as const,
  games: (from: string, to: string) =>
    [...sportsKeys.all, "games", from, to] as const,
  live: () => [...sportsKeys.all, "live"] as const,
  summary: (gameId: string) => [...sportsKeys.all, "summary", gameId] as const,
};

/** How often devices look again while a game is on; the server refreshes as often. */
export const LIVE_REFRESH_MS = 30 * 1000;
/** How often they check whether a game has started. */
const IDLE_REFRESH_MS = 5 * 60 * 1000;

/** Every league and whether a data source covers it yet. */
export function useSportsLeagues() {
  return useQuery({
    queryKey: sportsKeys.leagues(),
    queryFn: () => sportsService.leagues(),
    select: (response: ApiResponse<SportsLeagueInfo[]>) => response.data,
    staleTime: 60 * 60 * 1000,
  });
}

/** A league's teams matching what a parent typed. */
export function useTeamSearch(league: SportsLeague | null, query: string) {
  return useQuery({
    queryKey: sportsKeys.search(league ?? "MLB", query),
    queryFn: () => sportsService.searchTeams(league ?? "MLB", query),
    select: (response: ApiResponse<ProviderTeam[]>) => response.data,
    enabled: league !== null,
    staleTime: 60 * 60 * 1000,
  });
}

/** The family's followed teams. */
export function useFollowedTeams() {
  return useQuery({
    queryKey: sportsKeys.teams(),
    queryFn: () => sportsService.followed(),
    select: (response: ApiResponse<FollowedTeam[]>) => response.data,
    staleTime: 5 * 60 * 1000,
  });
}

/** Followed teams' games on these days ("yyyy-MM-dd"), for the calendar. */
export function useSportsGames(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: sportsKeys.games(from, to),
    queryFn: () => sportsService.games(from, to),
    select: (response: ApiResponse<SportsGame[]>) => response.data,
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Games live now or about to start. Looks again every 30 seconds while one is on, and
 * every five minutes otherwise, so an idle wall costs almost nothing.
 */
export function useLiveGames() {
  return useQuery({
    queryKey: sportsKeys.live(),
    queryFn: () => sportsService.live(),
    select: (response: ApiResponse<SportsGame[]>) => response.data,
    staleTime: 15 * 1000,
    refetchInterval: (query) =>
      (query.state.data?.data.length ?? 0) > 0
        ? LIVE_REFRESH_MS
        : IDLE_REFRESH_MS,
  });
}

/** The live panel's details, read only while the panel is open. */
export function useGameSummary(gameId: string | null) {
  return useQuery({
    queryKey: sportsKeys.summary(gameId ?? ""),
    queryFn: () => sportsService.summary(gameId ?? ""),
    select: (response: ApiResponse<GameSummary>) => response.data,
    enabled: gameId !== null,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });
}

function invalidateSports(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: sportsKeys.all });
}

export function useFollowTeam() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<FollowedTeam>,
    ApiException,
    { league: SportsLeague; providerTeamId: string }
  >({
    mutationFn: ({ league, providerTeamId }) =>
      sportsService.follow(league, providerTeamId),
    onSuccess: () => invalidateSports(queryClient),
  });
}

export function useUpdateFollowedTeam() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<FollowedTeam>,
    ApiException,
    { id: string } & FollowedTeamUpdate
  >({
    mutationFn: ({ id, ...update }) => sportsService.update(id, update),
    onSuccess: () => invalidateSports(queryClient),
  });
}

export function useUnfollowTeam() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiException, string>({
    mutationFn: (id) => sportsService.unfollow(id),
    onSuccess: () => invalidateSports(queryClient),
  });
}
