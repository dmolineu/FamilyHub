import { expect, type Locator, type Page, test } from "@playwright/test";
import { registerFamily, seedBrowserAuth } from "./helpers/api-helpers";
import {
  clearStorage,
  waitForHydration,
  waitForSheetSettled,
} from "./helpers/test-helpers";

const ZONE = "America/Los_Angeles";

/** Taps on touch devices, clicks elsewhere: everything here must work by touch alone. */
async function press(locator: Locator, isMobile: boolean) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

/** Today plus `days`, as a calendar date in the family's zone. */
function dateInZone(days: number) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

async function setBirthday(
  page: Page,
  isMobile: boolean,
  name: string,
  birthday: { year: number; month: number; day: number },
  expectedCountdown: string,
) {
  // Closing a profile can leave the Menu open behind it; tapping Menu again
  // would close it under the next tap.
  const menu = page.getByRole("dialog", { name: "Menu" });
  if (!(await menu.isVisible())) {
    await press(page.getByRole("button", { name: "Menu" }), isMobile);
  }
  await waitForSheetSettled(menu);
  await press(menu.getByRole("button", { name }), isMobile);
  const profile = page.getByRole("dialog", { name: "Member Profile" });
  await expect(profile).toBeVisible();

  await profile
    .getByLabel("Birthday month")
    .selectOption(String(birthday.month));
  await profile.getByLabel("Birthday day").selectOption(String(birthday.day));
  await profile.getByLabel("Birth year (optional)").fill(String(birthday.year));
  // The profile counts down as soon as the date is entered, before saving.
  await expect(profile.getByText(expectedCountdown)).toBeVisible();

  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/api/family/members/") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  await press(profile.getByRole("button", { name: "Save Changes" }), isMobile);
  await saved;
  await expect(profile).toBeHidden();
}

test.describe("Birthdays", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
  });

  test("a birthday set on a profile counts down on Home and is celebrated on the day", async ({
    page,
    request,
    isMobile,
  }) => {
    const registration = await registerFamily(request, {
      familyName: "Birthday Family",
      members: [
        { name: "Alice", color: "coral" },
        { name: "Bob", color: "teal" },
      ],
      timezone: ZONE,
    });
    await seedBrowserAuth(page, registration);
    await page.reload();
    await waitForHydration(page);

    const inNineDays = dateInZone(9);
    await setBirthday(
      page,
      isMobile,
      "Alice",
      { ...inNineDays, year: inNineDays.year - 9 },
      "In 9 days · turns 9",
    );
    const today = dateInZone(0);
    await setBirthday(
      page,
      isMobile,
      "Bob",
      { ...today, year: today.year - 40 },
      "Today · turns 40",
    );

    const menu = page.getByRole("dialog", { name: "Menu" });
    await press(menu.getByRole("button", { name: /close/i }), isMobile);
    await expect(menu).toBeHidden();

    const birthdays = page.getByRole("region", { name: "Birthdays" });
    await expect(birthdays).toBeVisible();
    await expect(
      birthdays.getByRole("heading", { name: "Happy birthday, Bob!" }),
    ).toBeVisible();
    await expect(birthdays.getByText("Bob turns 40 today")).toBeVisible();
    const alice = birthdays.getByRole("listitem").filter({ hasText: "Alice" });
    await expect(alice).toContainText("Alice turns 9");
    await expect(alice).toContainText("In 9 days");

    // Still there after a reload, so it was saved, not just held in the form.
    await page.reload();
    await waitForHydration(page);
    await expect(
      page
        .getByRole("region", { name: "Birthdays" })
        .getByRole("listitem")
        .filter({ hasText: "Alice" }),
    ).toContainText("In 9 days");
  });
});
