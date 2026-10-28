import { expect, type Page, test } from "@playwright/test";
import {
  createCalendarEvent,
  registerFamily,
  seedBrowserAuth,
} from "./helpers/api-helpers";
import {
  clearStorage,
  getTodayDateString,
  safeClick,
  switchCalendarView,
  waitForCalendarReady,
  waitForHydration,
  waitForSheetSettled,
} from "./helpers/test-helpers";

/** The two wall panels the kitchen screen may be. */
const wallViewports = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
] as const;

/** Laptops and phones, which must keep the standard layout. */
const standardViewports = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
] as const;

function rootFontSize(page: Page): Promise<number> {
  return page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  );
}

/**
 * Whether an hour grid shows the whole day: nothing left to scroll, and the rows
 * stretched to fill the grid rather than leaving a blank band under 11 PM.
 */
function fitOf(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => {
    const overflow = el.scrollHeight - el.clientHeight;
    const content = el.firstElementChild?.getBoundingClientRect().height ?? 0;
    const fill = content / el.clientHeight;
    return overflow <= 1 && fill >= 0.95
      ? "fits"
      : `overflow ${overflow}px, fill ${fill.toFixed(2)}`;
  });
}

async function signIn(
  page: Page,
  request: import("@playwright/test").APIRequestContext,
) {
  const reg = await registerFamily(request, {
    familyName: "Wall Family",
    members: [
      { name: "Alice", color: "coral" },
      { name: "Bob", color: "teal" },
    ],
  });
  const today = getTodayDateString();
  // Two overlapping events, so the week view has to place them side by side.
  for (const [title, memberIndex] of [
    ["Swim", 0],
    ["Piano", 1],
  ] as const) {
    await createCalendarEvent(request, reg.token, {
      title,
      date: today,
      startTime: "4:00 PM",
      endTime: "5:00 PM",
      memberId: reg.family.members[memberIndex].id,
      isAllDay: false,
    });
  }
  await seedBrowserAuth(page, reg);
  return reg;
}

test.describe("Wall display mode", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, "Viewport sizes are set by each test");
    await page.goto("/");
    await clearStorage(page);
  });

  for (const viewport of wallViewports) {
    test(`fits the hour grids on a ${viewport.width}x${viewport.height} wall`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize(viewport);
      await signIn(page, request);
      await page.goto("/?display=wall");
      await waitForHydration(page);
      await waitForCalendarReady(page);

      await expect(page.locator("html")).toHaveAttribute(
        "data-display",
        "wall",
      );
      // clamp(20px, 1.15vw, 30px): larger than a laptop's 16px at either size.
      expect(await rootFontSize(page)).toBeCloseTo(
        Math.min(30, Math.max(20, viewport.width * 0.0115)),
        0,
      );

      await switchCalendarView(page, "daily");
      await expect(page.getByTestId("day-lanes-scroll")).toBeVisible();
      await expect.poll(() => fitOf(page, "day-lanes-scroll")).toBe("fits");

      await switchCalendarView(page, "weekly");
      await expect(page.getByTestId("weekly-scroll")).toBeVisible();
      await expect.poll(() => fitOf(page, "weekly-scroll")).toBe("fits");

      const swim = page.locator("[data-event-box]", { hasText: "Swim" });
      const piano = page.locator("[data-event-box]", { hasText: "Piano" });
      const swimBox = await swim.boundingBox();
      const pianoBox = await piano.boundingBox();
      expect(swimBox && pianoBox).toBeTruthy();
      if (swimBox && pianoBox) {
        // Side by side in the day's column, not one on top of the other.
        const [left, right] =
          swimBox.x < pianoBox.x ? [swimBox, pianoBox] : [pianoBox, swimBox];
        expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1);
      }
    });
  }

  for (const viewport of standardViewports) {
    test(`keeps the standard layout at ${viewport.width}x${viewport.height}`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize(viewport);
      await signIn(page, request);
      await page.reload();
      await waitForHydration(page);

      await expect(page.locator("html")).not.toHaveAttribute(
        "data-display",
        /.*/,
      );
      expect(await rootFontSize(page)).toBe(16);
    });
  }

  test("is chosen per device in Preferences and survives a reload", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signIn(page, request);
    await page.reload();
    await waitForHydration(page);

    await safeClick(page.getByRole("button", { name: /^menu$/i }));
    const menu = page.getByRole("dialog", { name: "Menu" });
    await waitForSheetSettled(menu);
    await safeClick(menu.getByRole("button", { name: "Preferences" }));
    const preferences = page.getByRole("dialog", { name: "Preferences" });
    await waitForSheetSettled(preferences);

    const wallSwitch = preferences.getByRole("switch", {
      name: "Wall display",
    });
    await expect(wallSwitch).not.toBeChecked();
    await safeClick(wallSwitch);
    await expect(wallSwitch).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-display", "wall");

    await page.reload();
    await waitForHydration(page);
    await expect(page.locator("html")).toHaveAttribute("data-display", "wall");

    // The kiosk address can switch it back.
    await page.goto("/?display=standard");
    await waitForHydration(page);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-display",
      /.*/,
    );
    await page.reload();
    await waitForHydration(page);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-display",
      /.*/,
    );
  });
});
