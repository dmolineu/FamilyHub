import { act } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSummary, SportsGame } from "@/lib/types";
import { useSportsStore } from "@/stores/sports-store";
import {
  API_BASE,
  seedMockSports,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { LiveScores } from "./live-scores";

setupMswServer();

const LIVE: SportsGame = {
  id: "g1",
  providerGameId: "900004",
  league: "MLB",
  startAt: "2027-04-04T20:10:00Z",
  timeTbd: false,
  home: {
    teamId: "135",
    name: "San Diego Padres",
    abbreviation: "SD",
    score: 2,
    logoUrl: "https://img/135.svg",
  },
  away: {
    teamId: "119",
    name: "Los Angeles Dodgers",
    abbreviation: "LAD",
    score: 1,
    logoUrl: null,
  },
  venue: "Petco Park",
  broadcasts: ["Padres.TV"],
  state: "LIVE",
  detail: "Top 5th",
  followedTeamIds: ["f-sd"],
  color: null,
  memberIds: [],
  hideScores: false,
};

const SUMMARY: GameSummary = {
  gameId: "g1",
  detail: "Top 5th",
  lines: [
    {
      abbreviation: "LAD",
      stats: [
        { label: "R", value: "1" },
        { label: "H", value: "4" },
      ],
    },
    {
      abbreviation: "SD",
      stats: [
        { label: "R", value: "2" },
        { label: "H", value: "6" },
      ],
    },
  ],
  situation: ["2-1, 1 out", "Runner on 1st"],
  leaders: [{ label: "Batting", name: "Eve Slugger", line: "2-3 | HR" }],
};

describe("LiveScores", () => {
  beforeEach(() => {
    // The global ResizeObserver mock in src/test/setup.ts isn't constructable, which
    // crashes Radix Popper as soon as the panel mounts (as in month-overflow-popover).
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    seedFamilyStore({
      name: "F",
      members: [],
      timezone: "America/Los_Angeles",
    });
    useSportsStore.setState({ hideSports: false, revealedGameIds: [] });
    server.use(
      http.get(`${API_BASE}/sports/games/:id/summary`, () =>
        HttpResponse.json({ data: SUMMARY, message: "" }),
      ),
    );
  });
  afterEach(() => vi.useRealTimers());

  it("shows nothing while no followed game is on", async () => {
    const { container } = renderWithUser(<LiveScores />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a live game's score and inning, and its details on a tap", async () => {
    seedMockSports({ live: [LIVE] });
    const { user } = renderWithUser(<LiveScores />);

    const chip = await screen.findByRole("button", {
      name: "Live: Los Angeles Dodgers 1, San Diego Padres 2, Top 5th",
    });
    expect(chip).toHaveTextContent("LAD 1");
    expect(chip).toHaveTextContent("SD 2");

    await user.click(chip);

    const panel = await screen.findByRole("dialog", {
      name: "Los Angeles Dodgers at San Diego Padres",
    });
    expect(await screen.findByText("2-1, 1 out")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Runner on 1st");
    expect(panel).toHaveTextContent("Eve Slugger");
    expect(panel).toHaveTextContent("On Padres.TV");
  });

  it("keeps a hidden score hidden on this device until someone reveals it", async () => {
    seedMockSports({ live: [{ ...LIVE, hideScores: true }] });
    const { user } = renderWithUser(<LiveScores />);

    const chip = await screen.findByRole("button", {
      name: "Live: Los Angeles Dodgers at San Diego Padres, score hidden",
    });
    expect(chip).not.toHaveTextContent("2");
    await user.click(chip);
    const panel = await screen.findByRole("dialog");
    expect(panel).toHaveTextContent("Score hidden");
    expect(panel).not.toHaveTextContent("Eve Slugger");

    await user.click(screen.getByRole("button", { name: "Reveal score" }));

    expect(useSportsStore.getState().revealedGameIds).toEqual(["g1"]);
    expect(await screen.findByText("Eve Slugger")).toBeInTheDocument();
  });

  it("shows when a game about to start begins", async () => {
    seedMockSports({
      live: [
        {
          ...LIVE,
          state: "SCHEDULED",
          detail: null,
          home: { ...LIVE.home, score: null },
          away: { ...LIVE.away, score: null },
        },
      ],
    });
    renderWithUser(<LiveScores />);
    expect(
      await screen.findByRole("button", {
        name: "Starting soon: Los Angeles Dodgers at San Diego Padres, 1:10 PM",
      }),
    ).toBeInTheDocument();
  });

  it("closes the panel by itself after 20 seconds untouched", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedMockSports({ live: [LIVE] });
    const { user } = renderWithUser(<LiveScores />);
    await user.click(await screen.findByRole("button", { name: /^Live:/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
