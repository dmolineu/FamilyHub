import { httpClient } from "@/api/client";
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

/** Followed teams, their games and live scores. */
export const sportsService = {
  async leagues(): Promise<ApiResponse<SportsLeagueInfo[]>> {
    return httpClient.get<ApiResponse<SportsLeagueInfo[]>>("/sports/leagues");
  },

  async searchTeams(
    league: SportsLeague,
    query: string,
  ): Promise<ApiResponse<ProviderTeam[]>> {
    const params = new URLSearchParams({ query });
    return httpClient.get<ApiResponse<ProviderTeam[]>>(
      `/sports/leagues/${league}/teams?${params.toString()}`,
    );
  },

  async followed(): Promise<ApiResponse<FollowedTeam[]>> {
    return httpClient.get<ApiResponse<FollowedTeam[]>>("/sports/teams");
  },

  async follow(
    league: SportsLeague,
    providerTeamId: string,
  ): Promise<ApiResponse<FollowedTeam>> {
    return httpClient.post<ApiResponse<FollowedTeam>>("/sports/teams", {
      league,
      providerTeamId,
    });
  },

  async update(
    id: string,
    update: FollowedTeamUpdate,
  ): Promise<ApiResponse<FollowedTeam>> {
    return httpClient.patch<ApiResponse<FollowedTeam>>(
      `/sports/teams/${id}`,
      update,
    );
  },

  async unfollow(id: string): Promise<void> {
    await httpClient.delete<void>(`/sports/teams/${id}`);
  },

  /** Games starting on these days ("yyyy-MM-dd", family time zone). */
  async games(from: string, to: string): Promise<ApiResponse<SportsGame[]>> {
    const params = new URLSearchParams({ from, to });
    return httpClient.get<ApiResponse<SportsGame[]>>(
      `/sports/games?${params.toString()}`,
    );
  },

  async live(): Promise<ApiResponse<SportsGame[]>> {
    return httpClient.get<ApiResponse<SportsGame[]>>("/sports/live");
  },

  async summary(gameId: string): Promise<ApiResponse<GameSummary>> {
    return httpClient.get<ApiResponse<GameSummary>>(
      `/sports/games/${gameId}/summary`,
    );
  },
};
