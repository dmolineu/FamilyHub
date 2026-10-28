import { expect, type Locator, type Page, test } from "@playwright/test";
import { registerFamily, seedBrowserAuth } from "./helpers/api-helpers";
import { clearStorage, waitForHydration } from "./helpers/test-helpers";

/**
 * The followed-teams screens with the sports API answered in the page: the server's
 * side (MLB's feed, syncing, polling) has its own integration tests, and this spec
 * must not depend on a live MLB game or MLB's servers.
 */

async function press(locator: Locator, isMobile: boolean) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

const PADRES = {
  id: "135",
  name: "San Diego Padres",
  shortName: "Padres",
  abbreviation: "SD",
  logoUrl: null,
};

function liveGame(hideScores: boolean) {
  return {
    id: "game-1",
    providerGameId: "900004",
    league: "MLB",
    startAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    timeTbd: false,
    home: {
      teamId: "135",
      name: "San Diego Padres",
      abbreviation: "SD",
      score: 2,
      logoUrl: null,
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
    followedTeamIds: ["followed-135"],
    color: null,
    memberIds: [],
    hideScores,
  };
}

async function answerSports(page: Page, options: { hideScores: boolean }) {
  const followed: Record<string, unknown>[] = [];
  const json = (data: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data, message: "" }),
  });
  await page.route("**/api/sports/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/sports/, "");
    if (path === "/leagues") {
      return route.fulfill(
        json([
          { league: "NFL", name: "NFL", available: false },
          { league: "MLB", name: "MLB", available: true },
          {
            league: "COLLEGE_FOOTBALL",
            name: "College football",
            available: false,
          },
          {
            league: "MENS_COLLEGE_BASKETBALL",
            name: "Men's college basketball",
            available: false,
          },
        ]),
      );
    }
    if (path.startsWith("/leagues/MLB/teams")) {
      const query = (url.searchParams.get("query") ?? "").toLowerCase();
      return route.fulfill(
        json([PADRES].filter((t) => t.name.toLowerCase().includes(query))),
      );
    }
    if (path === "/teams" && request.method() === "POST") {
      const team = {
        id: "followed-135",
        league: "MLB",
        providerTeamId: "135",
        name: PADRES.name,
        shortName: PADRES.shortName,
        abbreviation: PADRES.abbreviation,
        logoUrl: null,
        color: null,
        showOnCalendar: true,
        hideScores: options.hideScores,
        memberIds: [],
      };
      followed.push(team);
      return route.fulfill({ ...json(team), status: 201 });
    }
    if (path === "/teams") return route.fulfill(json(followed));
    if (path.startsWith("/teams/") && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      Object.assign(followed[0], body);
      return route.fulfill(json(followed[0]));
    }
    if (path === "/live")
      return route.fulfill(json([liveGame(options.hideScores)]));
    if (path.endsWith("/summary")) {
      return route.fulfill(
        json({
          gameId: "game-1",
          detail: "Top 5th",
          lines: [
            { abbreviation: "LAD", stats: [{ label: "R", value: "1" }] },
            { abbreviation: "SD", stats: [{ label: "R", value: "2" }] },
          ],
          situation: ["2-1, 1 out"],
          leaders: [
            { label: "Batting", name: "Eve Slugger", line: "2-3 | HR" },
          ],
        }),
      );
    }
    if (path === "/games") return route.fulfill(json([]));
    return route.fulfill({ status: 404, body: "{}" });
  });
}

test.describe("Followed teams", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
  });

  test("a parent follows a team and its live score opens by touch", async ({
    page,
    request,
    isMobile,
  }) => {
    await answerSports(page, { hideScores: false });
    const registration = await registerFamily(request, {
      familyName: "Sports Family",
      members: [{ name: "Dad", color: "coral" }],
    });
    await seedBrowserAuth(page, registration);
    await page.reload();
    await waitForHydration(page);

    await press(page.getByRole("button", { name: "Menu" }), isMobile);
    await press(
      page.getByRole("button", { name: "Family Settings" }),
      isMobile,
    );
    const settings = page.getByRole("dialog", { name: "Family Settings" });
    await press(
      settings.getByRole("button", { name: "Follow a team" }),
      isMobile,
    );
    await settings.getByLabel("Search MLB teams").fill("pad");
    await press(
      settings.getByRole("button", { name: "Follow San Diego Padres" }),
      isMobile,
    );
    const card = settings.getByRole("listitem", { name: "San Diego Padres" });
    await expect(card).toBeVisible();
    await press(card.getByRole("button", { name: "Dad is a fan" }), isMobile);
    await expect(
      card.getByRole("button", { name: "Dad is a fan" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(settings).toBeHidden();
    // Family Settings opened from the menu, which is still open behind it.
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    const chip = page.getByRole("button", {
      name: "Live: Los Angeles Dodgers 1, San Diego Padres 2, Top 5th",
    });
    await press(chip, isMobile);
    const panel = page.getByRole("dialog", {
      name: "Los Angeles Dodgers at San Diego Padres",
    });
    await expect(panel).toContainText("2-1, 1 out");
    await expect(panel).toContainText("Eve Slugger");
  });

  test("a hidden score stays hidden until someone taps to reveal it", async ({
    page,
    request,
    isMobile,
  }) => {
    await answerSports(page, { hideScores: true });
    const registration = await registerFamily(request, {
      familyName: "Spoiler Family",
      members: [{ name: "Dad", color: "coral" }],
    });
    await seedBrowserAuth(page, registration);
    await page.reload();
    await waitForHydration(page);

    const chip = page.getByRole("button", {
      name: "Live: Los Angeles Dodgers at San Diego Padres, score hidden",
    });
    await press(chip, isMobile);
    const panel = page.getByRole("dialog");
    await expect(panel).toContainText("Score hidden");
    await expect(panel).not.toContainText("Eve Slugger");
    await press(panel.getByRole("button", { name: "Reveal score" }), isMobile);
    await expect(panel).toContainText("Eve Slugger");
  });
});
