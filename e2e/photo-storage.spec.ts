import { expect, type Locator, test } from "@playwright/test";
import {
  getFamily,
  registerFamily,
  seedBrowserAuth,
  setMemberPin,
} from "./helpers/api-helpers";
import { clearStorage, waitForHydration } from "./helpers/test-helpers";

async function press(locator: Locator, isMobile: boolean) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

test.describe("Photo storage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
  });

  test("a parent moves the photo library to another folder with their PIN", async ({
    page,
    request,
    isMobile,
  }) => {
    const registration = await registerFamily(request, {
      familyName: "Photo Family",
      members: [{ name: "Mom", color: "coral" }],
    });
    const [mom] = registration.family.members;
    await setMemberPin(request, registration.token, mom.id, "2468");
    await seedBrowserAuth(page, {
      ...registration,
      family: await getFamily(request, registration.token),
    });
    await page.reload();
    await waitForHydration(page);

    await press(page.getByRole("button", { name: "Menu" }), isMobile);
    await press(
      page.getByRole("button", { name: "Family Settings" }),
      isMobile,
    );
    const settings = page.getByRole("dialog", { name: "Family Settings" });
    await expect(settings.getByText("/photos/library")).toBeVisible();

    // A folder per test run, so reruns against one backend never collide.
    const folder = `/photos/e2e-${Date.now()}`;
    await press(
      settings.getByRole("button", { name: "Move to another folder" }),
      isMobile,
    );
    await settings.getByLabel("New folder").fill(folder);
    await press(settings.getByRole("button", { name: "Next" }), isMobile);
    await press(settings.getByRole("button", { name: "Mom" }), isMobile);
    for (const digit of "2468") {
      await press(
        settings.getByRole("button", { name: digit, exact: true }),
        isMobile,
      );
    }
    await press(
      settings.getByRole("button", { name: "Move photos" }),
      isMobile,
    );

    await expect(settings.getByRole("status")).toHaveText(
      `Moved 0 photos to ${folder}.`,
    );
    await expect(settings.getByText(folder, { exact: true })).toBeVisible();
  });
});
