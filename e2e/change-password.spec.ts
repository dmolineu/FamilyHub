import { expect, test } from "@playwright/test";
import {
  registerFamily,
  seedBrowserAuth,
  TEST_PASSWORD,
} from "./helpers/api-helpers";
import {
  clearStorage,
  waitForCalendarReady,
  waitForHydration,
} from "./helpers/test-helpers";

const NEW_PASSWORD = "AnotherPassword456!";

test.describe("Changing the sign-in password", () => {
  test("keeps this device signed in and signs every other device out", async ({
    page,
    browser,
    request,
  }) => {
    const reg = await registerFamily(request, {
      familyName: "Password Family",
      members: [{ name: "Alice", color: "coral" }],
    });

    // The wall: signed in on the same token, in its own browser context.
    const wallContext = await browser.newContext();
    const wall = await wallContext.newPage();
    await wall.goto("/");
    await clearStorage(wall);
    await seedBrowserAuth(wall, reg);
    await wall.reload();
    await waitForHydration(wall);
    await waitForCalendarReady(wall);

    // This device changes the password.
    await page.goto("/");
    await clearStorage(page);
    await seedBrowserAuth(page, reg);
    await page.reload();
    await waitForHydration(page);
    await waitForCalendarReady(page);

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", {
      name: "Settings",
      exact: true,
    });
    await expect(settings).toBeVisible();
    await settings.getByRole("tab", { name: "Accounts" }).click();

    await settings.getByRole("button", { name: "Change password" }).click();
    await settings.getByLabel("Current password").fill(TEST_PASSWORD);
    await settings
      .getByLabel("New password", { exact: true })
      .fill(NEW_PASSWORD);
    await settings.getByLabel("New password again").fill(NEW_PASSWORD);
    await settings.getByRole("button", { name: "Save password" }).click();
    await expect(
      settings.getByText(
        "Password changed. Other phones, laptops and the wall will ask for the new one.",
      ),
    ).toBeVisible();

    // Still signed in here after a reload, on the fresh token.
    await page.reload();
    await waitForHydration(page);
    await waitForCalendarReady(page);

    // The wall's token predates the change, so its next request signs it out.
    await wall.reload();
    await expect(wall.getByText("Welcome Back!")).toBeVisible({
      timeout: 15000,
    });

    // And the new password is the one that works there.
    await wall.getByLabel("Username").fill(reg.username);
    await wall.getByLabel("Password").fill(NEW_PASSWORD);
    await wall.getByRole("button", { name: "Sign In" }).click();
    await waitForCalendarReady(wall);

    await wallContext.close();
  });
});
