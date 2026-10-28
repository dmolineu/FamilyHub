import { beforeEach, describe, expect, it } from "vitest";
import type { FollowedTeam } from "@/lib/types";
import { useSportsStore } from "@/stores/sports-store";
import { seedMockSports, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { FamilyFilterPills } from "./family-filter-pills";

setupMswServer();

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
  memberIds: [],
};

describe("FamilyFilterPills", () => {
  beforeEach(() => {
    seedFamilyStore({
      name: "F",
      members: [{ id: "m1", name: "Alice", color: "coral" }],
    });
    useSportsStore.setState({ hideSports: false, revealedGameIds: [] });
  });

  it("offers no Sports pill until the family follows a team", async () => {
    renderWithUser(<FamilyFilterPills />);
    expect(await screen.findByText("All")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sports/i }),
    ).not.toBeInTheDocument();
  });

  it("hides and shows followed teams' games on this device", async () => {
    seedMockSports({ followed: [PADRES] });
    const { user } = renderWithUser(<FamilyFilterPills />);

    const pill = await screen.findByRole("button", { name: "Sports" });
    expect(pill).toHaveAttribute("aria-pressed", "true");

    await user.click(pill);

    expect(useSportsStore.getState().hideSports).toBe(true);
    expect(pill).toHaveAttribute("aria-pressed", "false");
  });
});
