import { expect, test } from "@playwright/test";
import { registerFamily, seedBrowserAuth } from "./helpers/api-helpers";
import {
  clearStorage,
  waitForCalendarReady,
  waitForHydration,
} from "./helpers/test-helpers";

// An event can be for several people (Phase 4). In a new event the first tap picks that
// person in place of the default; later taps add or remove. The first one leads.
test.describe("Shared events", () => {
  test.beforeEach(async ({ page, request }) => {
    await page.goto("/");
    await clearStorage(page);
    const reg = await registerFamily(request, {
      familyName: "Shared Family",
      members: [
        { name: "Alice", color: "coral" },
        { name: "Bob", color: "teal" },
      ],
    });
    await seedBrowserAuth(page, reg);
    await page.reload();
    await waitForHydration(page);
    await waitForCalendarReady(page);
  });

  test("makes an event for two people, then takes one off", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add event" }).click();
    const add = page.getByRole("dialog", { name: "Add Event" });
    await expect(add).toBeVisible();
    await add.getByLabel("Event Name").fill("Shared Ride");
    await add.getByRole("button", { name: "Bob", exact: true }).click();
    await add.getByRole("button", { name: "Alice", exact: true }).click();
    await expect(
      add.getByRole("button", { name: "Bob", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      add.getByRole("button", { name: "Alice", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await add.getByRole("button", { name: /add event/i }).click();
    await expect(add).toBeHidden();

    await page
      .getByRole("button", { name: /Shared Ride/ })
      .first()
      .click();
    const detail = page.getByRole("dialog");
    // Bob was tapped first, so he leads.
    await expect(detail.getByText("Bob, Alice")).toBeVisible();

    await detail.getByRole("button", { name: /edit/i }).click();
    const edit = page.getByRole("dialog", { name: "Edit Event" });
    await expect(edit).toBeVisible();
    await edit.getByRole("button", { name: "Bob", exact: true }).click();
    await expect(
      edit.getByRole("button", { name: "Bob", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await edit.getByRole("button", { name: /save changes/i }).click();
    await expect(edit).toBeHidden();

    await page
      .getByRole("button", { name: /Shared Ride/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog").getByText("Alice", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Bob, Alice")).toBeHidden();
  });
});
