import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  approveWaitingChores,
  completeCurrentChore,
  createChoreTemplate,
  getChoresBoard,
  getFamily,
  registerFamily,
  seedBrowserAuth,
  setMemberPin,
  setMemberRole,
} from "./helpers/api-helpers";
import { clearStorage, waitForHydration } from "./helpers/test-helpers";

/** Taps on touch devices, clicks elsewhere: the shop must work by touch alone. */
async function press(locator: Locator, isMobile: boolean) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

async function tapPin(page: Page, pin: string, isMobile: boolean) {
  for (const digit of pin) {
    await press(
      page.getByRole("button", { name: digit, exact: true }),
      isMobile,
    );
  }
}

async function openChores(page: Page, isMobile: boolean) {
  await press(
    page
      .getByRole("navigation", { name: /primary|main/i })
      .getByRole("button", { name: "Chores" })
      .first(),
    isMobile,
  );
  await expect(
    page.getByRole("heading", { name: "Chores", level: 1 }),
  ).toBeVisible();
}

test.describe("Rewards shop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
  });

  test("a parent adds a reward, a kid asks for it and a parent's approval spends the points", async ({
    page,
    request,
    isMobile,
  }) => {
    const registration = await registerFamily(request, {
      familyName: "Reward Family",
      members: [
        { name: "Mom", color: "coral" },
        { name: "Maya", color: "teal" },
      ],
    });
    const [mom, maya] = registration.family.members;
    await setMemberRole(request, registration.token, maya.id, "KID");
    await setMemberPin(request, registration.token, mom.id, "2468");
    const board = await getChoresBoard(request, registration.token);
    const chore = await createChoreTemplate(request, registration.token, {
      title: "Tidy room",
      assignedToMemberIds: [maya.id],
      cadence: "DAILY",
      activeFrom: board.today.periodStartDate,
      points: 30,
    });
    await completeCurrentChore(request, registration.token, chore.id, {
      scope: "TODAY",
      periodStartDate: board.today.periodStartDate,
    });
    await approveWaitingChores(request, registration.token, mom.id, "2468");
    await seedBrowserAuth(page, {
      ...registration,
      family: await getFamily(request, registration.token),
    });
    await page.reload();
    await waitForHydration(page);
    await openChores(page, isMobile);
    await expect(
      page.getByRole("region", { name: "Kids' points" }),
    ).toContainText("30 points");

    // A parent adds a reward behind their own PIN.
    await press(page.getByRole("button", { name: "Rewards" }), isMobile);
    const shop = page.getByRole("dialog", { name: "Rewards" });
    await press(shop.getByRole("button", { name: "Manage rewards" }), isMobile);
    await press(shop.getByRole("button", { name: "Mom" }), isMobile);
    await tapPin(page, "2468", isMobile);
    await press(shop.getByRole("button", { name: "Open" }), isMobile);
    await expect(shop.getByText("Changing rewards as Mom")).toBeVisible();
    await press(shop.getByRole("button", { name: "Add a reward" }), isMobile);
    await shop.getByLabel("Reward", { exact: true }).fill("Screen time");
    await press(shop.getByRole("button", { name: "5 more points" }), isMobile);
    await press(shop.getByRole("button", { name: "5 more points" }), isMobile);
    await press(shop.getByRole("button", { name: "Save reward" }), isMobile);
    await expect(shop.getByText("20 points")).toBeVisible();
    await press(shop.getByRole("button", { name: "Lock" }), isMobile);
    await press(
      shop.getByRole("button", { name: "Back to the shop" }),
      isMobile,
    );

    // Maya asks for it; the points are held, not spent.
    await press(shop.getByRole("button", { name: "Maya" }), isMobile);
    await expect(shop.getByText("Maya has 30 points to spend")).toBeVisible();
    await press(
      shop.getByRole("button", { name: "Ask for Screen time" }),
      isMobile,
    );
    await expect(
      shop.getByText("Maya has 10 points to spend (20 waiting)"),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(shop).toBeHidden();

    // A parent approves it in Approvals.
    await press(page.getByRole("button", { name: "1 to approve" }), isMobile);
    const approvals = page.getByRole("dialog", { name: "Approvals" });
    await press(approvals.getByRole("button", { name: "Mom" }), isMobile);
    await tapPin(page, "2468", isMobile);
    await press(approvals.getByRole("button", { name: "Open" }), isMobile);
    await press(
      approvals.getByRole("button", { name: "Approve Screen time for Maya" }),
      isMobile,
    );
    await expect(approvals.getByRole("status")).toHaveText(
      "Approved Screen time for Maya.",
    );
    await page.keyboard.press("Escape");

    await expect(
      page.getByRole("region", { name: "Kids' points" }),
    ).toContainText("10 points");
  });
});
