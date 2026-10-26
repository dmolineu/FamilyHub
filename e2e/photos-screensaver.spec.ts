import { expect, type Page, test } from "@playwright/test";
import { registerFamily, seedBrowserAuth } from "./helpers/api-helpers";
import { clearStorage, waitForHydration } from "./helpers/test-helpers";

const API_BASE = "http://localhost:8080/api";

/** Real JPEGs, drawn by the browser itself, in two colours so they differ. */
async function makeJpegs(page: Page): Promise<Buffer[]> {
  const urls = await page.evaluate(() =>
    ["#2f241d", "#ffc425"].map((colour) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.fillStyle = colour;
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.8);
    }),
  );
  return urls.map((url) => Buffer.from(url.split(",")[1], "base64"));
}

async function openPhotos(page: Page) {
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name: "Photos" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Photos", level: 1 }),
  ).toBeVisible();
}

test.describe("Photos and the screensaver", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop flow");
    await page.goto("/");
    await clearStorage(page);
  });

  test("uploaded photos play in the screensaver; swipe changes photo, a tap closes it", async ({
    page,
    request,
  }) => {
    // Two photos are resized in the browser and stored by the server first.
    test.setTimeout(60_000);
    const registration = await registerFamily(request, {
      familyName: "Photo Family",
      members: [{ name: "Maya", color: "teal" }],
    });
    const maya = registration.family.members[0];
    const response = await request.put(
      `${API_BASE}/family/members/${maya.id}`,
      {
        headers: { Authorization: `Bearer ${registration.token}` },
        data: {
          name: "Maya",
          color: "teal",
          birthday: { month: 1, day: 5, year: 2016 },
        },
      },
    );
    expect(response.ok()).toBe(true);
    await seedBrowserAuth(page, registration);
    await page.reload();
    await waitForHydration(page);
    await openPhotos(page);
    await expect(page.getByText("No photos yet")).toBeVisible();

    const [brown, gold] = await makeJpegs(page);
    await page.getByLabel("Add photos").setInputFiles([
      { name: "brown.jpg", mimeType: "image/jpeg", buffer: brown },
      { name: "gold.jpg", mimeType: "image/jpeg", buffer: gold },
    ]);
    await expect(page.getByRole("status")).toHaveText("Added 2 photos.");
    await expect(page.getByRole("img", { name: /^Added / })).toHaveCount(2);

    await page.getByRole("button", { name: "Start slideshow" }).click();
    const screensaver = page.getByTestId("screensaver");
    await expect(screensaver).toBeVisible();
    await expect(page.getByTestId("screensaver-time")).toHaveText(
      /^\d{1,2}:\d{2}\s[AP]M$/,
    );
    await expect(
      screensaver.getByRole("region", { name: "Birthdays" }),
    ).toContainText(/Maya.*(In \d+ days|Tomorrow|Today)/);
    const photo = page.getByTestId("screensaver-photo");
    await expect(photo).toBeVisible();
    const first = await photo.getAttribute("data-photo-id");

    // Swipe left: the other photo, and the screensaver stays.
    const box = await screensaver.boundingBox();
    if (!box) throw new Error("no screensaver box");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.75, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, y, { steps: 8 });
    await page.mouse.up();
    await expect(photo).not.toHaveAttribute("data-photo-id", first ?? "");
    await expect(screensaver).toBeVisible();

    // A tap closes it and lands back on Photos, nothing underneath clicked.
    await page.mouse.click(box.x + box.width / 2, y);
    await expect(screensaver).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Photos", level: 1 }),
    ).toBeVisible();
  });

  test("starts by itself after this device's idle time", async ({
    page,
    request,
  }) => {
    const registration = await registerFamily(request, {
      familyName: "Idle Family",
      members: [{ name: "Leo", color: "coral" }],
    });
    await page.clock.install();
    await seedBrowserAuth(page, registration);
    await page.evaluate(() =>
      localStorage.setItem(
        "family-hub-screensaver",
        JSON.stringify({ state: { delay: 1 }, version: 0 }),
      ),
    );
    await page.reload();
    await waitForHydration(page);
    await expect(page.getByTestId("screensaver")).toHaveCount(0);

    await page.clock.fastForward("01:05");

    await expect(page.getByTestId("screensaver")).toBeVisible();
  });
});
