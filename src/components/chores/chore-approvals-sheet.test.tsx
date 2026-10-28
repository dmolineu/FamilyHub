import { act } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChoreApprovalRequest,
  FamilyMember,
  ParentPinRequest,
  PendingChoreApproval,
  RedemptionDecisionRequest,
} from "@/lib/types";
import {
  API_BASE,
  seedMockRewardShop,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  within,
} from "@/test/test-utils";
import { ChoreApprovalsSheet } from "./chore-approvals-sheet";

setupMswServer();

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral", role: "PARENT", hasPin: true },
  { id: "dad", name: "Dad", color: "green", role: "PARENT", hasPin: true },
  { id: "maya", name: "Maya", color: "teal", role: "KID", hasPin: false },
  { id: "leo", name: "Leo", color: "orange", role: "KID", hasPin: false },
];

function waiting(
  completionId: string,
  choreTitle: string,
  memberName: string,
  completedAt: string,
  points: number | null = 5,
): PendingChoreApproval {
  return {
    completionId,
    choreTemplateId: `t-${choreTitle}`,
    choreTitle,
    memberId: memberName.toLowerCase(),
    memberName,
    completedAt,
    periodStartDate: completedAt.slice(0, 10),
    periodEndDate: completedAt.slice(0, 10),
    points,
  };
}

// UTC, as the API sends completion times: 16:05Z is 9:05 AM in Los Angeles.
const PENDING: PendingChoreApproval[] = [
  waiting("c1", "Feed the cat", "Maya", "2026-10-24T16:05:00"),
  waiting("c2", "Feed the cat", "Maya", "2026-10-25T16:10:00"),
  waiting("c3", "Make the bed", "Leo", "2026-10-25T15:00:00", null),
];

let pending: PendingChoreApproval[];
let unlocks: ParentPinRequest[];
let decisions: ChoreApprovalRequest[];
let decisionStatus: number;

function serve() {
  server.use(
    http.post(`${API_BASE}/chores/approvals/pending`, async ({ request }) => {
      const body = (await request.json()) as ParentPinRequest;
      unlocks.push(body);
      if (body.pin !== "2468") {
        return HttpResponse.json(
          { message: "Wrong PIN for Mom. 4 tries left." },
          { status: 403 },
        );
      }
      return HttpResponse.json({ data: pending, message: "" });
    }),
    http.post(`${API_BASE}/chores/approvals`, async ({ request }) => {
      const body = (await request.json()) as ChoreApprovalRequest;
      decisions.push(body);
      if (decisionStatus !== 200) {
        return HttpResponse.json(
          { message: "Mom's PIN is locked after too many wrong tries." },
          { status: decisionStatus },
        );
      }
      const decided = [...(body.approve ?? []), ...(body.reject ?? [])];
      pending = pending.filter((p) => !decided.includes(p.completionId));
      return HttpResponse.json({
        data: {
          approved: body.approve?.length ?? 0,
          rejected: body.reject?.length ?? 0,
        },
      });
    }),
  );
}

async function unlock(user: ReturnType<typeof renderWithUser>["user"]) {
  await user.click(screen.getByRole("button", { name: "Mom" }));
  await user.type(screen.getByLabelText("Mom's PIN"), "2468");
  await user.click(screen.getByRole("button", { name: "Open" }));
  await screen.findByRole("list", { name: "Waiting for a parent" });
}

function rows() {
  return within(
    screen.getByRole("list", { name: "Waiting for a parent" }),
  ).getAllByRole("listitem");
}

describe("ChoreApprovalsSheet", () => {
  beforeEach(() => {
    seedFamilyStore({ members: MEMBERS, timezone: "America/Los_Angeles" });
    pending = structuredClone(PENDING);
    unlocks = [];
    decisions = [];
    decisionStatus = 200;
    serve();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows nothing until a parent enters their PIN", () => {
    renderWithUser(<ChoreApprovalsSheet isOpen onClose={() => {}} />);

    expect(screen.getByText("Who is approving?")).toBeInTheDocument();
    expect(screen.queryByText("Feed the cat")).not.toBeInTheDocument();
    expect(unlocks).toHaveLength(0);
  });

  it("lists every waiting chore with the day and time it was ticked", async () => {
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await unlock(user);

    expect(unlocks).toEqual([{ approverMemberId: "mom", pin: "2468" }]);
    expect(screen.getByText("Approving as Mom")).toBeInTheDocument();
    const [first, second, third] = rows();
    // The same daily chore, ticked on two days, waits twice with its own time.
    expect(first).toHaveTextContent("Feed the cat");
    expect(first).toHaveTextContent("Maya");
    expect(first).toHaveTextContent(/Sat, Oct 24, 9:05\sAM/);
    expect(first).toHaveTextContent("5 points");
    expect(second).toHaveTextContent("Feed the cat");
    expect(second).toHaveTextContent(/Sun, Oct 25, 9:10\sAM/);
    expect(third).toHaveTextContent("Leo");
    expect(third).toHaveTextContent("No points set");
  });

  it("approves chores one at a time on that single PIN", async () => {
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await unlock(user);

    await user.click(
      within(rows()[1]).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Approved Feed the cat for Maya.",
    );
    await user.click(
      within(rows()[0]).getByRole("button", { name: "Approve" }),
    );

    expect(decisions).toEqual([
      { approverMemberId: "mom", pin: "2468", approve: ["c2"] },
      { approverMemberId: "mom", pin: "2468", approve: ["c1"] },
    ]);
    // Never asked for the PIN again.
    expect(screen.queryByLabelText("Mom's PIN")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it("rejects one with an optional reason", async () => {
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await unlock(user);

    const leo = rows()[2];
    await user.click(within(leo).getByRole("button", { name: "Reject" }));
    await user.type(within(leo).getByLabelText("Reason (optional)"), "Messy");
    await user.click(
      within(leo).getByRole("button", { name: "Reject Make the bed" }),
    );

    expect(decisions).toEqual([
      {
        approverMemberId: "mom",
        pin: "2468",
        reject: ["c3"],
        reason: "Messy",
      },
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Rejected Make the bed for Leo.",
    );
  });

  it("approves everything at once", async () => {
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await unlock(user);

    await user.click(screen.getByRole("button", { name: "Approve all 3" }));

    expect(decisions).toEqual([
      { approverMemberId: "mom", pin: "2468", approve: ["c1", "c2", "c3"] },
    ]);
    expect(await screen.findByText("All caught up.")).toBeInTheDocument();
  });

  it("locks again when closed, so the next person needs a PIN", async () => {
    const { user, rerender } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await unlock(user);

    rerender(<ChoreApprovalsSheet isOpen={false} onClose={() => {}} />);
    rerender(<ChoreApprovalsSheet isOpen onClose={() => {}} />);

    expect(screen.getByText("Who is approving?")).toBeInTheDocument();
    expect(screen.queryByText("Feed the cat")).not.toBeInTheDocument();
  });

  it("locks itself after two minutes untouched", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await unlock(user);

    act(() => vi.advanceTimersByTime(2 * 60 * 1000));

    expect(screen.getByText("Who is approving?")).toBeInTheDocument();
    expect(screen.getByText(/Locked after 2 minutes/)).toBeInTheDocument();
    expect(screen.queryByText("Feed the cat")).not.toBeInTheDocument();
  });

  it("shows why a PIN was refused", async () => {
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.type(screen.getByLabelText("Mom's PIN"), "0000");
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wrong PIN for Mom. 4 tries left.",
    );
  });

  it("locks again if a decision is refused, saying why", async () => {
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await unlock(user);
    decisionStatus = 403;

    await user.click(
      within(rows()[0]).getByRole("button", { name: "Approve" }),
    );

    expect(await screen.findByText("Who is approving?")).toBeInTheDocument();
    expect(
      screen.getByText(/locked after too many wrong tries/),
    ).toBeInTheDocument();
  });

  it("says when nothing is waiting", async () => {
    pending = [];
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.type(screen.getByLabelText("Mom's PIN"), "2468");
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(
      await screen.findByText("Nothing is waiting for a parent."),
    ).toBeInTheDocument();
  });

  describe("rewards", () => {
    let rewardDecisions: RedemptionDecisionRequest[];

    beforeEach(() => {
      rewardDecisions = [];
      seedMockRewardShop({
        rewards: [],
        waiting: [
          {
            id: "ask1",
            rewardId: "screen",
            rewardTitle: "Screen time",
            memberId: "maya",
            memberName: "Maya",
            points: 20,
            status: "PENDING",
            requestedAt: "2026-10-27T16:00:00Z",
          },
        ],
      });
      server.use(
        http.post(
          `${API_BASE}/rewards/redemptions/decide`,
          async ({ request }) => {
            const body = (await request.json()) as RedemptionDecisionRequest;
            rewardDecisions.push(body);
            return HttpResponse.json({
              data: {
                approved: body.approve?.length ?? 0,
                declined: body.decline?.length ?? 0,
              },
              message: "",
            });
          },
        ),
      );
    });

    it("lists asks for rewards after the PIN, and approving spends them", async () => {
      const { user } = renderWithUser(
        <ChoreApprovalsSheet isOpen onClose={() => {}} />,
      );
      expect(screen.queryByText("Screen time")).not.toBeInTheDocument();
      await unlock(user);

      const asks = await screen.findByRole("list", {
        name: "Rewards asked for",
      });
      expect(asks).toHaveTextContent("Screen time");
      expect(asks).toHaveTextContent("Maya");
      expect(asks).toHaveTextContent("20 points");

      await user.click(
        within(asks).getByRole("button", {
          name: "Approve Screen time for Maya",
        }),
      );

      expect(rewardDecisions).toEqual([
        { approverMemberId: "mom", pin: "2468", approve: ["ask1"] },
      ]);
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Approved Screen time for Maya.",
      );
    });

    it("declines with an optional reason", async () => {
      const { user } = renderWithUser(
        <ChoreApprovalsSheet isOpen onClose={() => {}} />,
      );
      await unlock(user);
      const asks = await screen.findByRole("list", {
        name: "Rewards asked for",
      });

      await user.click(within(asks).getByRole("button", { name: "Decline" }));
      await user.type(
        within(asks).getByLabelText("Reason (optional)"),
        "Homework first",
      );
      await user.click(
        within(asks).getByRole("button", { name: "Decline Screen time" }),
      );

      expect(rewardDecisions).toEqual([
        {
          approverMemberId: "mom",
          pin: "2468",
          decline: ["ask1"],
          reason: "Homework first",
        },
      ]);
    });
  });
});
