import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { type FamilyApiResponse, familyKeys } from "@/api";
import type { FamilyData, FollowedTeam, SportsGame } from "@/lib/types";
import { useSportsStore } from "@/stores/sports-store";
import { seedMockSports, setupMswServer } from "@/test/mocks/server";
import { useCalendarEvents } from "./use-calendar";

const FAMILY: FamilyData = {
  id: "family-1",
  name: "Sports Family",
  timezone: "America/Los_Angeles",
  members: [{ id: "dad", name: "Dad", color: "coral" }],
  createdAt: "2025-01-01T00:00:00.000Z",
};

const PADRES: FollowedTeam = {
  id: "f-sd",
  league: "MLB",
  providerTeamId: "135",
  name: "San Diego Padres",
  shortName: "Padres",
  abbreviation: "SD",
  logoUrl: null,
  color: null,
  showOnCalendar: true,
  hideScores: false,
  memberIds: ["dad"],
};

const GAME: SportsGame = {
  id: "g1",
  providerGameId: "900001",
  league: "MLB",
  startAt: "2026-10-28T02:10:00Z",
  timeTbd: false,
  home: {
    teamId: "135",
    name: "San Diego Padres",
    abbreviation: "SD",
    score: null,
    logoUrl: null,
  },
  away: {
    teamId: "119",
    name: "Los Angeles Dodgers",
    abbreviation: "LAD",
    score: null,
    logoUrl: null,
  },
  venue: "Petco Park",
  broadcasts: [],
  state: "SCHEDULED",
  detail: null,
  followedTeamIds: ["f-sd"],
  color: null,
  memberIds: ["dad"],
  hideScores: false,
};

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  client.setQueryData<FamilyApiResponse>(familyKeys.family(), { data: FAMILY });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useCalendarEvents with followed teams' games", () => {
  setupMswServer();

  beforeEach(() => {
    useSportsStore.setState({ hideSports: false, revealedGameIds: [] });
    seedMockSports({ followed: [PADRES], games: [GAME] });
  });

  it("adds the games in the range as read-only entries", async () => {
    const { result } = renderHook(
      () =>
        useCalendarEvents({ startDate: "2026-10-25", endDate: "2026-10-31" }),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(
        (result.current.data?.data ?? []).filter((e) => e.source === "SPORTS"),
      ).toHaveLength(1),
    );
    const game = (result.current.data?.data ?? []).find(
      (e) => e.source === "SPORTS",
    );
    expect(game?.title).toBe("Padres vs Los Angeles Dodgers");
    expect(game?.memberIds).toEqual(["dad"]);
  });

  it("leaves them out on a device that hides sports", async () => {
    const { result } = renderHook(
      () =>
        useCalendarEvents({ startDate: "2026-10-25", endDate: "2026-10-31" }),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(
        (result.current.data?.data ?? []).some((e) => e.source === "SPORTS"),
      ).toBe(true),
    );

    act(() => useSportsStore.getState().setHideSports(true));

    await waitFor(() =>
      expect(
        (result.current.data?.data ?? []).some((e) => e.source === "SPORTS"),
      ).toBe(false),
    );
  });
});
