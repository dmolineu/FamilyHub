import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  importAvatarPack,
  registerFamily,
  seedBrowserAuth,
} from "./helpers/api-helpers";
import { CHARACTER_PNG, PHOTO_JPEG } from "./helpers/avatar-images";
import { clearStorage, waitForHydration } from "./helpers/test-helpers";

/** Taps on touch devices, clicks elsewhere: everything here must work by touch alone. */
async function press(locator: Locator, isMobile: boolean) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

async function openProfile(page: Page, isMobile: boolean, name: string) {
  await press(page.getByRole("button", { name: "Menu" }), isMobile);
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await press(menu.getByRole("button", { name }), isMobile);
  const profile = page.getByRole("dialog", { name: "Member Profile" });
  await expect(profile).toBeVisible();
  return profile;
}

test.describe("Member avatars", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
  });

  test("a member picks a character, a built-in picture and a framed photo", async ({
    page,
    request,
    isMobile,
  }) => {
    const registration = await registerFamily(request, {
      familyName: "Avatar Family",
      members: [{ name: "Alice", color: "coral" }],
    });
    await importAvatarPack(request, registration.token, {
      version: 1,
      name: "Test Characters",
      characters: [
        { key: "sunny", name: "Sunny", group: "Friends", image: CHARACTER_PNG },
      ],
    });
    await seedBrowserAuth(page, registration);
    await page.reload();
    await waitForHydration(page);

    // A character from the family's pack, copied onto Alice as a small PNG.
    let profile = await openProfile(page, isMobile, "Alice");
    const changePicture = profile.getByRole("button", {
      name: "Change picture",
    });
    await press(changePicture, isMobile);
    await expect(
      profile.getByRole("region", { name: "Friends" }),
    ).toBeVisible();
    await press(profile.getByRole("button", { name: "Sunny" }), isMobile);
    await expect(changePicture).toBeVisible();
    await expect(changePicture.locator("img")).toHaveAttribute(
      "src",
      /^data:image\/png;base64,/,
    );

    // A picture drawn for the app.
    await press(changePicture, isMobile);
    await press(profile.getByRole("tab", { name: "Pictures" }), isMobile);
    await press(profile.getByRole("button", { name: "Fox" }), isMobile);
    await expect(
      changePicture.locator('svg[data-avatar-key="fox"]'),
    ).toBeVisible();

    // A photo, zoomed and framed in the circle.
    await press(changePicture, isMobile);
    await press(profile.getByRole("tab", { name: "Photo" }), isMobile);
    await profile.getByLabel("Choose a photo").setInputFiles({
      name: "beach.jpg",
      mimeType: "image/jpeg",
      buffer: PHOTO_JPEG,
    });
    await expect(
      profile.getByRole("group", { name: /photo position/i }),
    ).toBeVisible();
    await press(profile.getByRole("button", { name: "Zoom in" }), isMobile);
    await press(
      profile.getByRole("button", { name: "Use this photo" }),
      isMobile,
    );
    await expect(changePicture.locator("img")).toHaveAttribute(
      "src",
      /^data:image\/jpeg;base64,/,
    );

    // It was saved on the server: a fresh load shows the photo in the menu.
    await page.reload();
    await waitForHydration(page);
    profile = await openProfile(page, isMobile, "Alice");
    await expect(
      profile.getByRole("button", { name: "Change picture" }).locator("img"),
    ).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  });
});
