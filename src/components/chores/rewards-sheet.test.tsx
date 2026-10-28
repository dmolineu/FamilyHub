import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChorePoints, FamilyMember, RewardShop } from "@/lib/types";
import {
  API_BASE,
  seedMockFamily,
  seedMockRewardShop,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
  within,
} from "@/test/test-utils";
import { RewardsSheet } from "./rewards-sheet";

setupMswServer();

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral", role: "PARENT", hasPin: true },
  { id: "maya", name: "Maya", color: "teal", role: "KID", hasPin: false },
];

const POINTS: ChorePoints[] = [
  { memberId: "mom", memberName: "Mom", role: "PARENT", points: 0 },
  { memberId: "maya", memberName: "Maya", role: "KID", points: 30 },
];

const SHOP: RewardShop = {
  rewards: [
    {
      id: "screen",
      title: "Screen time",
      description: "30 minutes",
      points: 20,
    },
    { id: "bike", title: "Bike ride", description: null, points: 50 },
  ],
  waiting: [],
};

function open() {
  return renderWithUser(<RewardsSheet isOpen onClose={() => {}} />);
}

async function tapPin(
  user: ReturnType<typeof renderWithUser>["user"],
  pin: string,
) {
  for (const digit of pin) {
    await user.click(screen.getByRole("button", { name: digit }));
  }
}

describe("RewardsSheet", () => {
  beforeEach(() => {
    seedFamilyStore({ members: MEMBERS, timezone: "America/Los_Angeles" });
    seedMockFamily({ id: "f", name: "F", members: MEMBERS, createdAt: "" });
    seedMockRewardShop(SHOP);
    server.use(
      http.get(`${API_BASE}/chores/points`, () =>
        HttpResponse.json({ data: POINTS, message: "" }),
      ),
    );
  });

  it("starts with who is choosing, kids first", async () => {
    open();
    const who = await screen.findByRole("group", { name: "Who is choosing?" });
    // Accessible names leave out the avatar's hidden initial.
    const [first, second] = within(who).getAllByRole("button", {
      name: /^(Maya|Mom)$/,
    });
    expect(first).toBe(within(who).getByRole("button", { name: "Maya" }));
    expect(second).toBe(within(who).getByRole("button", { name: "Mom" }));
  });

  it("shows what a kid's points buy and how many more the rest need", async () => {
    const { user } = open();
    await user.click(await screen.findByRole("button", { name: "Maya" }));

    expect(
      await screen.findByText("Maya has 30 points to spend"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ask for Screen time" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Ask for Bike ride" }),
    ).toBeDisabled();
    expect(screen.getByText("Needs 20 more points")).toBeInTheDocument();
  });

  it("asking holds the points until a parent decides, and can be taken back", async () => {
    const { user } = open();
    await user.click(await screen.findByRole("button", { name: "Maya" }));
    await user.click(
      await screen.findByRole("button", { name: "Ask for Screen time" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Asked for Screen time. A parent will decide.",
    );
    const waiting = await screen.findByRole("list", {
      name: "Waiting for a parent",
    });
    expect(waiting).toHaveTextContent("Screen time");
    expect(
      await screen.findByText("Maya has 10 points to spend (20 waiting)"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Take back Screen time" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("list", { name: "Waiting for a parent" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText("Maya has 30 points to spend"),
    ).toBeInTheDocument();
  });

  it("parents add, change and remove rewards after their PIN", async () => {
    const { user } = open();
    await user.click(
      await screen.findByRole("button", { name: "Manage rewards" }),
    );
    await user.click(screen.getByRole("button", { name: "Mom" }));
    await tapPin(user, "2468");
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(
      await screen.findByText("Changing rewards as Mom"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a reward" }));
    await user.type(screen.getByLabelText("Reward"), "Ice cream");
    await user.clear(screen.getByLabelText("Points"));
    await user.type(screen.getByLabelText("Points"), "15");
    await user.click(screen.getByRole("button", { name: "Save reward" }));
    expect(await screen.findByText("Ice cream")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Screen time" }));
    await user.clear(screen.getByLabelText("Points"));
    await user.type(screen.getByLabelText("Points"), "25");
    await user.click(screen.getByRole("button", { name: "Save reward" }));
    expect(await screen.findByText("25 points")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Bike ride" }));
    await user.click(screen.getByRole("button", { name: "Remove reward" }));
    await waitFor(() =>
      expect(screen.queryByText("Bike ride")).not.toBeInTheDocument(),
    );
  });

  it("a wrong PIN keeps the rewards locked and says why", async () => {
    const { user } = open();
    await user.click(
      await screen.findByRole("button", { name: "Manage rewards" }),
    );
    await user.click(screen.getByRole("button", { name: "Mom" }));
    await tapPin(user, "1111");
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wrong PIN for Mom",
    );
    expect(
      screen.queryByText("Changing rewards as Mom"),
    ).not.toBeInTheDocument();
  });
});
