import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ChoreApprovalRequest,
  FamilyMember,
  PendingChoreApproval,
} from "@/lib/types";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { ChoreApprovalsSheet } from "./chore-approvals-sheet";

setupMswServer();

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral", role: "PARENT", hasPin: true },
  { id: "maya", name: "Maya", color: "teal", role: "KID", hasPin: false },
];

const PENDING: PendingChoreApproval[] = [
  {
    completionId: "c1",
    choreTemplateId: "t1",
    choreTitle: "Feed the cat",
    memberId: "maya",
    memberName: "Maya",
    completedAt: "2026-10-25T16:05:00",
    periodStartDate: "2026-10-25",
    periodEndDate: "2026-10-25",
    points: 5,
  },
  {
    completionId: "c2",
    choreTemplateId: "t2",
    choreTitle: "Make the bed",
    memberId: "maya",
    memberName: "Maya",
    completedAt: "2026-10-25T08:00:00",
    periodStartDate: "2026-10-25",
    periodEndDate: "2026-10-25",
    points: null,
  },
];

let pending: PendingChoreApproval[];
let decided: ChoreApprovalRequest | null;

function serve(decision: () => Response | Promise<Response>) {
  server.use(
    http.get(`${API_BASE}/chores/approvals`, () =>
      HttpResponse.json({ data: pending, message: "" }),
    ),
    http.post(`${API_BASE}/chores/approvals`, async ({ request }) => {
      decided = (await request.json()) as ChoreApprovalRequest;
      return decision();
    }),
  );
}

async function enterMomsPin(user: ReturnType<typeof renderWithUser>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Mom" }));
  await user.type(screen.getByLabelText("Mom's PIN"), "2468");
}

describe("ChoreApprovalsSheet", () => {
  beforeEach(() => {
    seedFamilyStore({ members: MEMBERS, timezone: "America/Los_Angeles" });
    pending = structuredClone(PENDING);
    decided = null;
  });

  it("lists each waiting chore with who did it and its points", async () => {
    serve(() => HttpResponse.json({ data: { approved: 0, rejected: 0 } }));
    renderWithUser(<ChoreApprovalsSheet isOpen onClose={() => {}} />);

    const cat = await screen.findByRole("checkbox", {
      name: /Feed the cat/,
    });
    expect(cat).toBeChecked();
    expect(cat.closest("label")).toHaveTextContent("Maya");
    expect(cat.closest("label")).toHaveTextContent("5 points");
    expect(
      screen.getByRole("checkbox", { name: /Make the bed/ }).closest("label"),
    ).toHaveTextContent("No points set");
  });

  it("approves the chosen chores with a parent's PIN", async () => {
    serve(() => {
      pending = pending.filter((p) => p.completionId !== "c1");
      return HttpResponse.json({ data: { approved: 1, rejected: 0 } });
    });
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );

    await user.click(
      await screen.findByRole("checkbox", { name: /Make the bed/ }),
    );
    await user.click(screen.getByRole("button", { name: "Approve 1" }));
    expect(screen.getByText("Who is approving?")).toBeInTheDocument();
    await enterMomsPin(user);
    await user.click(screen.getByRole("button", { name: "Approve 1 chore" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Approved 1 chore.",
    );
    expect(decided).toMatchObject({
      approverMemberId: "mom",
      pin: "2468",
      approve: ["c1"],
    });
    expect(decided?.reject ?? []).toEqual([]);
  });

  it("rejects with an optional reason", async () => {
    serve(() => HttpResponse.json({ data: { approved: 0, rejected: 2 } }));
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );

    await screen.findByRole("checkbox", { name: /Feed the cat/ });
    await user.click(screen.getByRole("button", { name: "Reject 2" }));
    await user.type(screen.getByLabelText("Reason (optional)"), "Still messy");
    await enterMomsPin(user);
    await user.click(screen.getByRole("button", { name: "Reject 2 chores" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Rejected 2 chores.",
    );
    expect(decided).toMatchObject({
      approverMemberId: "mom",
      pin: "2468",
      reject: ["c1", "c2"],
      reason: "Still messy",
    });
  });

  it("shows why a PIN was refused", async () => {
    serve(() =>
      HttpResponse.json(
        { message: "Wrong PIN for Mom. 4 tries left." },
        { status: 403 },
      ),
    );
    const { user } = renderWithUser(
      <ChoreApprovalsSheet isOpen onClose={() => {}} />,
    );

    await screen.findByRole("checkbox", { name: /Feed the cat/ });
    await user.click(screen.getByRole("button", { name: "Approve 2" }));
    await enterMomsPin(user);
    await user.click(screen.getByRole("button", { name: "Approve 2 chores" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wrong PIN for Mom. 4 tries left.",
    );
  });

  it("says when nothing is waiting", async () => {
    pending = [];
    serve(() => HttpResponse.json({ data: { approved: 0, rejected: 0 } }));
    renderWithUser(<ChoreApprovalsSheet isOpen onClose={() => {}} />);

    expect(
      await screen.findByText("Nothing is waiting for a parent."),
    ).toBeInTheDocument();
  });
});
