import { expect, type Page, test } from "@playwright/test";
import {
  createChoreTemplate,
  getChoresBoard,
  getFamily,
  registerFamily,
  seedBrowserAuth,
  setMemberPin,
  setMemberRole,
} from "./helpers/api-helpers";
import { clearStorage, waitForHydration } from "./helpers/test-helpers";

/** Taps a PIN on the keypad, the way it is entered at the wall. */
async function tapPin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

async function openChores(page: Page) {
  await page.reload();
  await waitForHydration(page);
  // Desktop and large screens show the modules in the sidebar navigation.
  await page
    .getByRole("navigation", { name: /primary|main/i })
    .getByRole("button", { name: "Chores" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Chores", level: 1 }),
  ).toBeVisible();
}

test.describe("Chore approvals", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop flow; the sheets are shared with mobile");
    await page.goto("/");
    await clearStorage(page);
  });

  test("a kid's chore waits for a parent's PIN, then the log says who approved it", async ({
    page,
    request,
  }) => {
    const registration = await registerFamily(request, {
      familyName: "Approval Family",
      members: [
        { name: "Mom", color: "coral" },
        { name: "Maya", color: "teal" },
      ],
    });
    const [mom, maya] = registration.family.members;
    await setMemberRole(request, registration.token, maya.id, "KID");
    await setMemberPin(request, registration.token, mom.id, "2468");
    const board = await getChoresBoard(request, registration.token);
    await createChoreTemplate(request, registration.token, {
      title: "Feed the cat",
      assignedToMemberIds: [maya.id],
      cadence: "DAILY",
      activeFrom: board.today.periodStartDate,
      points: 5,
    });
    await seedBrowserAuth(page, {
      ...registration,
      family: await getFamily(request, registration.token),
    });
    await openChores(page);

    const strip = page.getByRole("region", { name: "Kids' points" });
    await expect(strip).toContainText("Maya");
    await expect(strip).toContainText("0 points");

    await page
      .getByRole("button", { name: /mark feed the cat complete/i })
      .click();
    const row = page
      .locator('[data-testid^="chore-row-"]')
      .filter({ hasText: "Feed the cat" });
    await expect(row).toContainText("Waiting for a parent");
    await expect(row).toContainText("5 pts");

    await page.getByRole("button", { name: "1 to approve" }).click();
    const approvals = page.getByRole("dialog", { name: "Approvals" });
    // Nothing shows until a parent's PIN opens it.
    await expect(approvals).not.toContainText("Feed the cat");
    await approvals.getByRole("button", { name: "Mom" }).click();
    await tapPin(page, "2468");
    const waiting = approvals.getByRole("list", {
      name: "Waiting for a parent",
    });
    await expect(waiting).toContainText("Feed the cat");
    await expect(waiting).toContainText(
      /ticked \w{3}, \w{3} \d{1,2}(,| at) \d{1,2}:\d{2}/,
    );
    await waiting.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(approvals.getByRole("status")).toHaveText(
      "Approved Feed the cat for Maya.",
    );
    await expect(approvals.getByText("All caught up.")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(strip).toContainText("5 points");
    await expect(row).not.toContainText("Waiting for a parent");
    await expect(page.getByRole("button", { name: /to approve$/ })).toHaveCount(
      0,
    );

    await page.getByRole("button", { name: "Chore log" }).click();
    const log = page.getByRole("dialog", { name: "Chore log" });
    await log.getByRole("button", { name: "Mom" }).click();
    await tapPin(page, "2468");
    const lines = log.getByRole("listitem");
    await expect(lines).toHaveCount(2);
    await expect(lines.first()).toContainText("Approved by Mom");
    await expect(lines.first()).toContainText("+5");
    await expect(lines.nth(1)).toContainText("Ticked off");
  });

  test("five wrong PINs lock only that parent", async ({ page, request }) => {
    const registration = await registerFamily(request, {
      familyName: "Lockout Family",
      members: [
        { name: "Mom", color: "coral" },
        { name: "Dad", color: "green" },
      ],
    });
    const [mom, dad] = registration.family.members;
    await setMemberPin(request, registration.token, mom.id, "2468");
    await setMemberPin(request, registration.token, dad.id, "1357");
    await seedBrowserAuth(page, {
      ...registration,
      family: await getFamily(request, registration.token),
    });
    await openChores(page);

    await page.getByRole("button", { name: "Chore log" }).click();
    const log = page.getByRole("dialog", { name: "Chore log" });
    await log.getByRole("button", { name: "Mom" }).click();
    for (const left of [
      "4 tries left",
      "3 tries left",
      "2 tries left",
      "1 try left",
    ]) {
      await tapPin(page, "9999");
      await expect(log.getByRole("alert")).toContainText(left);
    }
    await tapPin(page, "9999");
    await expect(log.getByRole("alert")).toContainText("locked");

    // Mom's PIN is locked even when right; Dad is unaffected.
    await tapPin(page, "2468");
    await expect(log.getByRole("alert")).toContainText("locked");
    await log.getByRole("button", { name: "Not Mom?" }).click();
    await log.getByRole("button", { name: "Dad" }).click();
    await tapPin(page, "1357");
    await expect(
      log.getByText("Nothing in the log for this selection yet."),
    ).toBeVisible();
  });
});
