import { expect, test } from "@playwright/test";
import { registerFamily, seedBrowserAuth } from "./helpers/api-helpers";
import {
  clearStorage,
  safeClick,
  waitForCalendarReady,
  waitForHydration,
} from "./helpers/test-helpers";

// The time picker lives in a popover inside the Add Event dialog. The dialog's
// scroll lock used to cancel wheel and touch scrolling on the portaled popover,
// so the hour/minute wheels could only be clicked, never scrolled.
test.describe("Time picker wheels", () => {
  test.beforeEach(async ({ page, request }) => {
    await page.goto("/");
    await clearStorage(page);
    const reg = await registerFamily(request, {
      familyName: "Scroll Family",
      members: [{ name: "Alex", color: "coral" }],
    });
    await seedBrowserAuth(page, reg);
    await page.reload();
    await waitForHydration(page);
    await waitForCalendarReady(page);
  });

  test("scroll with the mouse wheel inside the Add Event dialog", async ({
    page,
    isMobile,
  }) => {
    await safeClick(page.getByRole("button", { name: "Add event" }));
    const dialog = page.getByRole("dialog", { name: "Add Event" });
    await expect(dialog).toBeVisible();

    // The start-time trigger shows the current value, e.g. "9:00 AM".
    const timeTrigger = dialog
      .getByRole("button", { name: /\d{1,2}:\d{2} (AM|PM)/ })
      .first();
    await safeClick(timeTrigger);

    const hourColumn = page.locator('div[style*="scroll-snap-type"]').first();
    await expect(hourColumn).toBeVisible();
    await page.waitForTimeout(300); // let the column settle on the current hour

    // A real wheel gesture, where the automation supports one (mobile WebKit
    // has no mouse wheel; the synthetic-event check below still covers it).
    if (!isMobile) {
      const before = await hourColumn.evaluate((el) => el.scrollTop);
      const box = await hourColumn.boundingBox();
      if (!box) throw new Error("hour column has no bounding box");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 120);
      await expect
        .poll(async () => hourColumn.evaluate((el) => el.scrollTop), {
          message: "the hour column should scroll under the mouse wheel",
        })
        .not.toBe(before);
    }

    // The dialog's scroll lock must not cancel scroll events on the column.
    const prevented = await hourColumn.evaluate((el) => {
      const event = new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
  });
});
