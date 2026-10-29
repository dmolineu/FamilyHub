import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ChoreActivityEntry,
  ChoreActivityRequest,
  ChorePoints,
  FamilyMember,
} from "@/lib/types";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  within,
} from "@/test/test-utils";
import { ChoreLogSheet } from "./chore-log-sheet";

setupMswServer();

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral", role: "PARENT", hasPin: true },
  { id: "dad", name: "Dad", color: "green", role: "PARENT", hasPin: true },
  { id: "maya", name: "Maya", color: "teal", role: "KID" },
  { id: "leo", name: "Leo", color: "orange", role: "KID" },
];

function entry(partial: Partial<ChoreActivityEntry>): ChoreActivityEntry {
  return {
    id: "x",
    kind: "COMPLETED",
    choreTemplateId: "t1",
    choreTitle: "Feed the cat",
    memberId: "maya",
    memberName: "Maya",
    points: 0,
    actorMemberId: null,
    actorName: null,
    reason: null,
    periodStartDate: "2026-10-25",
    occurredAt: "2026-10-25T16:05:00Z",
    ...partial,
  };
}

const ACTIVITY: ChoreActivityEntry[] = [
  entry({
    id: "a3",
    kind: "APPROVED",
    points: 5,
    actorMemberId: "mom",
    actorName: "Mom",
    occurredAt: "2026-10-25T23:10:00Z",
  }),
  entry({
    id: "a2",
    kind: "REJECTED",
    choreTitle: "Make the bed",
    memberId: "leo",
    memberName: "Leo",
    actorMemberId: "dad",
    actorName: "Dad",
    reason: "Still messy",
    occurredAt: "2026-10-25T18:00:00Z",
  }),
  entry({ id: "a1", kind: "COMPLETED", occurredAt: "2026-10-25T16:05:00Z" }),
];

const POINTS: ChorePoints[] = [
  { memberId: "dad", memberName: "Dad", role: "PARENT", points: 0 },
  { memberId: "leo", memberName: "Leo", role: "KID", points: 0 },
  { memberId: "maya", memberName: "Maya", role: "KID", points: 5 },
  { memberId: "mom", memberName: "Mom", role: "PARENT", points: 0 },
];

let opened: ChoreActivityRequest | null;

describe("ChoreLogSheet", () => {
  beforeEach(() => {
    seedFamilyStore({ members: MEMBERS, timezone: "America/Los_Angeles" });
    opened = null;
    server.use(
      http.get(`${API_BASE}/chores/points`, () =>
        HttpResponse.json({ data: POINTS, message: "" }),
      ),
      http.post(`${API_BASE}/chores/activity`, async ({ request }) => {
        opened = (await request.json()) as ChoreActivityRequest;
        if (opened.pin !== "2468") {
          return HttpResponse.json(
            { message: "Wrong PIN for Mom. 4 tries left." },
            { status: 403 },
          );
        }
        return HttpResponse.json({ data: ACTIVITY, message: "" });
      }),
    );
  });

  async function open(pin = "2468") {
    const view = renderWithUser(<ChoreLogSheet isOpen onClose={() => {}} />);
    expect(screen.getByText("Who is opening the log?")).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Mom" }));
    await view.user.type(screen.getByLabelText("Mom's PIN"), pin);
    return view;
  }

  it("needs a parent's PIN, then lists who did what and who approved it", async () => {
    await open();

    const items = await screen.findAllByRole("listitem");
    expect(opened).toEqual({ approverMemberId: "mom", pin: "2468" });
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Feed the cat");
    expect(items[0]).toHaveTextContent("Maya");
    expect(items[0]).toHaveTextContent("Approved by Mom");
    expect(items[0]).toHaveTextContent("+5");
    // Times read in the family's time zone: 23:10Z is 4:10 PM in Los Angeles.
    expect(items[0]).toHaveTextContent("4:10 PM");
    expect(items[1]).toHaveTextContent("Rejected by Dad: Still messy");
    expect(items[2]).toHaveTextContent("Ticked off");
  });

  it("says when points were spent on a reward and when a reward was declined", async () => {
    server.use(
      http.post(`${API_BASE}/chores/activity`, () =>
        HttpResponse.json({
          data: [
            entry({
              id: "r2",
              kind: "DECLINED",
              choreTemplateId: null,
              choreTitle: "Ice cream",
              actorMemberId: "dad",
              actorName: "Dad",
              reason: "Not before dinner",
              occurredAt: "2026-10-26T01:00:00Z",
            }),
            entry({
              id: "r1",
              kind: "REDEEMED",
              choreTemplateId: null,
              choreTitle: "Screen time",
              points: -20,
              actorMemberId: "mom",
              actorName: "Mom",
              occurredAt: "2026-10-26T00:30:00Z",
            }),
          ],
          message: "",
        }),
      ),
    );
    await open();

    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Ice cream");
    expect(items[0]).toHaveTextContent(
      "Reward declined by Dad: Not before dinner",
    );
    expect(items[1]).toHaveTextContent("Screen time");
    expect(items[1]).toHaveTextContent("Reward approved by Mom");
    expect(items[1]).toHaveTextContent("-20");
  });

  it("shows the kids' points balances", async () => {
    await open();

    const balances = await screen.findByRole("region", { name: "Points" });
    expect(within(balances).getByText("Maya")).toBeInTheDocument();
    expect(within(balances).getByText("5 points")).toBeInTheDocument();
    expect(within(balances).queryByText("Mom")).not.toBeInTheDocument();
  });

  it("filters to one kid", async () => {
    const { user } = await open();
    await screen.findAllByRole("listitem");

    await user.click(screen.getByRole("button", { name: "Leo" }));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Make the bed");
  });

  it("shows why a PIN was refused", async () => {
    await open("0000");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wrong PIN for Mom. 4 tries left.",
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
