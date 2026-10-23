import { expect, test } from "@playwright/test";
import { registerFamily, seedBrowserAuth } from "./helpers/api-helpers";
import {
  clearStorage,
  readPersistedQueryData,
  safeClick,
  waitForHydration,
  waitForSheetSettled,
} from "./helpers/test-helpers";

/**
 * Sidebar Preferences entry + family preferences sheet (#208).
 * Runs on desktop and mobile projects: the sheet renders as a full-height
 * bottom sheet below md and a centered dialog on desktop, but the flow and
 * locators are identical.
 */
test.describe("Preferences sheet", () => {
  let token: string;

  test.beforeEach(async ({ page, request }) => {
    await page.goto("/");
    await clearStorage(page);
    const reg = await registerFamily(request, {
      familyName: "Prefs Test Family",
      members: [{ name: "Alice", color: "coral" }],
      timezone: "America/Los_Angeles",
    });
    token = reg.token;
    await seedBrowserAuth(page, reg);
    await page.reload();
    await waitForHydration(page);
  });

  async function openPreferences(page: import("@playwright/test").Page) {
    await safeClick(page.getByRole("button", { name: /^menu$/i }));
    const menu = page.getByRole("dialog", { name: "Menu" });
    await waitForSheetSettled(menu);
    await safeClick(menu.getByRole("button", { name: "Preferences" }));

    const preferences = page.getByRole("dialog", { name: "Preferences" });
    await waitForSheetSettled(preferences);
    return preferences;
  }

  test("changes the family timezone and persists it across reload", async ({
    page,
    request,
  }) => {
    const preferences = await openPreferences(page);

    // Shows the BE-stored zone, not a hardcoded default.
    const select = preferences.getByLabel(/family timezone/i);
    await expect(select).toHaveValue("America/Los_Angeles");

    const putDone = page.waitForResponse(
      (response) =>
        response.url().includes("/api/family") &&
        response.request().method() === "PUT" &&
        response.ok(),
    );
    await select.selectOption("America/New_York");
    await putDone;

    // The change reached the backend, not just the local cache.
    const familyResponse = await request.get(
      "http://127.0.0.1:8080/api/family",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(familyResponse.ok()).toBe(true);
    const family = await familyResponse.json();
    expect(family.data.timezone).toBe("America/New_York");

    // Survives a full reload. The reload rehydrates the family query from the
    // offline read cache (IndexedDB), which takes precedence over useFamily's
    // localStorage initialData seed; its 5-minute staleTime then suppresses a
    // corrective refetch. Wait for the new zone to be durable there first,
    // otherwise the reload can resurface the stale pre-change zone (flaky).
    await expect
      .poll(
        async () =>
          (
            await readPersistedQueryData<{ data?: { timezone?: string } }>(
              page,
              ["family", "data"], // familyKeys.family()
            )
          )?.data?.timezone,
        { timeout: 10000 },
      )
      .toBe("America/New_York");

    await page.reload();
    await waitForHydration(page);
    const reopened = await openPreferences(page);
    await expect(reopened.getByLabel(/family timezone/i)).toHaveValue(
      "America/New_York",
    );
  });

  test("shows a disabled Coming soon row for Notifications", async ({
    page,
  }) => {
    const preferences = await openPreferences(page);

    const notifications = preferences.getByRole("button", {
      name: /notifications/i,
    });
    await expect(notifications).toBeDisabled();
  });

  test("the chosen look is painted, survives reload and stays on this device only", async ({
    page,
    browser,
  }) => {
    const preferences = await openPreferences(page);
    const looks = preferences.getByRole("radiogroup", { name: "Look" });
    await expect(looks.getByRole("radio", { name: "Default" })).toBeChecked();

    // The radio itself is visually hidden; its card is the label.
    await looks.getByText("Midnight", { exact: true }).click();
    await expect(looks.getByRole("radio", { name: "Midnight" })).toBeChecked();
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "midnight");
    await expect(html).toHaveClass(/\bdark\b/);

    // Survives a reload, painted by the boot script before React runs.
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "midnight");
    await expect(html).toHaveClass(/\bdark\b/);

    // Another device (a fresh browser context with the same family) is untouched.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/");
    await expect(otherPage.locator("html")).not.toHaveAttribute(
      "data-theme",
      "midnight",
    );
    await other.close();
  });
});
