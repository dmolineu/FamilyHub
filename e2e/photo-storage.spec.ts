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

  test("a parent unlocks Settings with their PIN and moves the photo library", async ({
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
      page.getByRole("button", { name: "Settings", exact: true }),
      isMobile,
    );
    const settings = page.getByRole("dialog", {
      name: "Settings",
      exact: true,
    });
    // Mom has a PIN, so the settings open only after her face and PIN.
    await expect(settings.getByText("/photos/library")).toBeHidden();
    await press(
      settings.getByRole("button", { name: "Mom", exact: true }),
      isMobile,
    );
    for (const digit of "2468") {
      await press(
        settings.getByRole("button", { name: digit, exact: true }),
        isMobile,
      );
    }
    await expect(settings.getByText("Unlocked by Mom")).toBeVisible();
    await press(settings.getByRole("tab", { name: "Photos" }), isMobile);
    await expect(settings.getByText("/photos/library")).toBeVisible();

    // A folder per test run, so reruns against one backend never collide.
    const folder = `/photos/e2e-${Date.now()}`;
    await press(
      settings.getByRole("button", { name: "Move to another folder" }),
      isMobile,
    );
    // The server's folders can be tapped through; the photos' current one is there.
    const folders = settings.getByRole("navigation", { name: "Folders" });
    await press(
      folders.getByRole("button", { name: "photos", exact: true }),
      isMobile,
    );
    await expect(settings.getByLabel("New folder")).toHaveValue("/photos");
    await expect(
      folders.getByRole("button", { name: "library", exact: true }),
    ).toBeVisible();
    // A new folder does not exist yet, so its name is typed.
    await settings.getByLabel("New folder").fill(folder);
    await press(settings.getByRole("button", { name: "Next" }), isMobile);
    // Unlocked already: the move goes ahead as Mom without asking again.
    await expect(settings.getByText(/Going ahead as Mom/)).toBeVisible();
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
