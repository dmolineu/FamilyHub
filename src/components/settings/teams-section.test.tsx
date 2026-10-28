import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  FamilyMember,
  FollowedTeam,
  FollowedTeamUpdate,
  ProviderTeam,
} from "@/lib/types";
import {
  API_BASE,
  seedMockSports,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
  within,
} from "@/test/test-utils";
import { TeamsSection } from "./teams-section";

setupMswServer();

const MEMBERS: FamilyMember[] = [
  { id: "dad", name: "Dad", color: "coral" },
  { id: "leo", name: "Leo", color: "teal" },
];

const TEAMS: ProviderTeam[] = [
  {
    id: "135",
    name: "San Diego Padres",
    shortName: "Padres",
    abbreviation: "SD",
    logoUrl: "https://img/135.svg",
  },
  {
    id: "119",
    name: "Los Angeles Dodgers",
    shortName: "Dodgers",
    abbreviation: "LAD",
    logoUrl: null,
  },
];

const PADRES: FollowedTeam = {
  id: "followed-135",
  league: "MLB",
  providerTeamId: "135",
  name: "San Diego Padres",
  shortName: "Padres",
  abbreviation: "SD",
  logoUrl: "https://img/135.svg",
  color: null,
  showOnCalendar: true,
  hideScores: false,
  memberIds: [],
};

let updates: { id: string; body: FollowedTeamUpdate }[];

describe("TeamsSection", () => {
  beforeEach(() => {
    seedFamilyStore({ name: "F", members: MEMBERS });
    seedMockSports({ teams: TEAMS });
    updates = [];
  });

  it("follows a team found by searching its league", async () => {
    const { user } = renderWithUser(<TeamsSection />);
    expect(
      await screen.findByText(/not following any teams yet/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Follow a team" }));
    expect(screen.getByRole("tab", { name: "MLB" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.type(screen.getByLabelText("Search MLB teams"), "pad");
    const results = await screen.findByRole("list", { name: "MLB teams" });
    await waitFor(() =>
      expect(within(results).queryByText("Los Angeles Dodgers")).toBeNull(),
    );
    await user.click(
      within(results).getByRole("button", { name: "Follow San Diego Padres" }),
    );

    const followed = await screen.findByRole("list", {
      name: "Followed teams",
    });
    expect(followed).toHaveTextContent("San Diego Padres");
  });

  it("says which leagues have no data source yet", async () => {
    const { user } = renderWithUser(<TeamsSection />);
    await user.click(
      await screen.findByRole("button", { name: "Follow a team" }),
    );
    await user.click(screen.getByRole("tab", { name: "NFL" }));
    expect(
      screen.getByText(/no data source for NFL scores yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Search NFL teams")).not.toBeInTheDocument();
  });

  it("chooses fans, a colour and the switches for a followed team", async () => {
    seedMockSports({ followed: [PADRES] });
    server.use(
      http.patch(
        `${API_BASE}/sports/teams/:id`,
        async ({ params, request }) => {
          const body = (await request.json()) as FollowedTeamUpdate;
          updates.push({ id: String(params.id), body });
          return HttpResponse.json({
            data: { ...PADRES, ...body },
            message: "",
          });
        },
      ),
    );
    const { user } = renderWithUser(<TeamsSection />);
    const card = await screen.findByRole("listitem", {
      name: "San Diego Padres",
    });

    await user.click(
      within(card).getByRole("button", { name: "Leo is a fan" }),
    );
    await user.click(within(card).getByRole("button", { name: "Teal" }));
    await user.click(within(card).getByLabelText("Hide scores"));

    expect(updates).toEqual([
      { id: "followed-135", body: { memberIds: ["leo"] } },
      { id: "followed-135", body: { color: "#2f827f" } },
      { id: "followed-135", body: { hideScores: true } },
    ]);
  });

  it("unfollows after asking", async () => {
    seedMockSports({ followed: [PADRES] });
    const { user } = renderWithUser(<TeamsSection />);
    const card = await screen.findByRole("listitem", {
      name: "San Diego Padres",
    });
    await user.click(within(card).getByRole("button", { name: "Unfollow" }));
    await user.click(
      within(card).getByRole("button", { name: "Unfollow the Padres" }),
    );
    expect(
      await screen.findByText(/not following any teams yet/i),
    ).toBeInTheDocument();
  });
});
