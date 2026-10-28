import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  FamilyMember,
  InboxApproveRequest,
  InboxImport,
} from "@/lib/types";
import {
  API_BASE,
  seedMockInbox,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  within,
} from "@/test/test-utils";
import { FamilyInboxSection } from "./family-inbox-section";

setupMswServer();

/** The PIN the mock server accepts. */
const PIN = "2468";

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral", role: "PARENT", hasPin: true },
  { id: "maya", name: "Maya", color: "teal", role: "KID" },
];

const PICTURE_DAY: InboxImport = {
  id: "picture-day",
  kind: "EVENT",
  status: "PENDING",
  title: "Picture day",
  confidence: "LOW",
  createdAt: "2027-03-01T16:00:00Z",
  decidedAt: null,
  sender: "mom@example.com",
  subject: "Spring flyer",
  proposal: {
    title: "Picture day",
    date: "2027-03-11",
    endDate: "",
    allDay: true,
    startTime: "",
    endTime: "",
    location: "",
    people: ["Maya"],
    uncertainty: "The flyer gives no year",
  },
  calendarEventId: null,
  recipeId: null,
  photoId: null,
};

const SWIM_MEET: InboxImport = {
  ...PICTURE_DAY,
  id: "swim-meet",
  status: "ADDED",
  title: "Swim meet",
  confidence: "HIGH",
  proposal: null,
  calendarEventId: "event-1",
};

async function tapPin(
  user: ReturnType<typeof renderWithUser>["user"],
  pin: string,
) {
  for (const digit of pin) {
    await user.click(screen.getByRole("button", { name: digit, exact: true }));
  }
}

async function asMom(user: ReturnType<typeof renderWithUser>["user"]) {
  await user.click(screen.getByRole("button", { name: "Mom", exact: true }));
  await tapPin(user, PIN);
}

describe("FamilyInboxSection", () => {
  beforeEach(() => {
    seedFamilyStore({ name: "F", members: MEMBERS });
  });

  it("says when the server has no mailbox to read yet", async () => {
    renderWithUser(<FamilyInboxSection />);
    expect(
      await screen.findByText(/not set up on the server yet/i),
    ).toBeInTheDocument();
  });

  it("shows where to send things and that photos still arrive without the reader", async () => {
    seedMockInbox({
      configured: true,
      address: "hub@example.com",
      readerAvailable: false,
      lastReadAt: new Date().toISOString(),
    });
    renderWithUser(<FamilyInboxSection />);

    expect(await screen.findByText("hub@example.com")).toBeInTheDocument();
    expect(screen.getByText(/checked/i)).toBeInTheDocument();
    expect(screen.getByText(/photos still arrive/i)).toBeInTheDocument();
  });

  it("lets a parent correct a waiting event and add it with their PIN", async () => {
    seedMockInbox({
      configured: true,
      address: "hub@example.com",
      imports: [PICTURE_DAY],
    });
    const sent: InboxApproveRequest[] = [];
    server.use(
      http.post(
        `${API_BASE}/inbox/imports/:id/approve`,
        async ({ request }) => {
          sent.push((await request.json()) as InboxApproveRequest);
          return HttpResponse.json({
            data: { ...PICTURE_DAY, status: "ADDED" },
            message: "",
          });
        },
      ),
    );
    const { user } = renderWithUser(<FamilyInboxSection />);

    const waiting = await screen.findByRole("region", {
      name: /waiting for a parent/i,
    });
    expect(within(waiting).getByText("Picture day")).toBeInTheDocument();
    expect(
      within(waiting).getByText(/the flyer gives no year/i),
    ).toBeInTheDocument();
    expect(within(waiting).getByText(/spring flyer/i)).toBeInTheDocument();

    await user.click(
      within(waiting).getByRole("button", { name: /check and add/i }),
    );
    const date = screen.getByLabelText("Date");
    expect(date).toHaveValue("2027-03-11");
    expect(screen.getByRole("switch", { name: "All day" })).toBeChecked();
    expect(screen.getByLabelText("For")).toHaveValue("maya");
    await user.clear(date);
    await user.type(date, "2027-03-12");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await asMom(user);
    await user.click(
      screen.getByRole("button", { name: "Add to the calendar" }),
    );

    expect(sent).toEqual([
      expect.objectContaining({
        approverMemberId: "mom",
        pin: PIN,
        title: "Picture day",
        date: "2027-03-12",
        allDay: true,
        memberId: "maya",
      }),
    ]);
  });

  it("asks for a start time before a timed event can be added", async () => {
    seedMockInbox({
      configured: true,
      imports: [
        {
          ...PICTURE_DAY,
          proposal: { ...PICTURE_DAY.proposal!, allDay: false, people: [] },
        },
      ],
    });
    const { user } = renderWithUser(<FamilyInboxSection />);

    await user.click(
      await screen.findByRole("button", { name: /check and add/i }),
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.type(screen.getByLabelText("Starts"), "15:00");
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("turns a waiting event down with a parent's PIN", async () => {
    seedMockInbox({ configured: true, imports: [PICTURE_DAY] });
    const { user } = renderWithUser(<FamilyInboxSection />);

    await user.click(await screen.findByRole("button", { name: /turn down/i }));
    await asMom(user);
    await user.click(screen.getByRole("button", { name: "Turn it down" }));

    expect(
      await screen.findByText(/nothing is waiting for a parent/i),
    ).toBeInTheDocument();
  });

  it("takes an added event off again with a parent's PIN", async () => {
    seedMockInbox({ configured: true, imports: [SWIM_MEET] });
    const { user } = renderWithUser(<FamilyInboxSection />);

    const added = await screen.findByRole("region", {
      name: /recently added/i,
    });
    await user.click(
      within(added).getByRole("button", { name: /undo swim meet/i }),
    );
    await asMom(user);
    await user.click(screen.getByRole("button", { name: "Take it off" }));

    expect(await within(added).findByText(/taken off/i)).toBeInTheDocument();
  });

  it("lets a parent allow another address and remove it", async () => {
    seedMockInbox({ configured: true, memberAddresses: ["mom@example.com"] });
    const { user } = renderWithUser(<FamilyInboxSection />);

    const senders = await screen.findByRole("region", {
      name: /who can send/i,
    });
    expect(within(senders).getByText("mom@example.com")).toBeInTheDocument();
    await user.click(
      within(senders).getByRole("button", { name: /allow another address/i }),
    );
    await user.type(
      screen.getByLabelText("Email address"),
      "Grandma@Example.org",
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await asMom(user);
    await user.click(
      screen.getByRole("button", { name: "Allow this address" }),
    );

    expect(
      await within(senders).findByText("grandma@example.org"),
    ).toBeInTheDocument();
    await user.click(
      within(senders).getByRole("button", {
        name: /remove grandma@example.org/i,
      }),
    );
    await asMom(user);
    await user.click(screen.getByRole("button", { name: "Remove it" }));
    expect(
      within(senders).queryByText("grandma@example.org"),
    ).not.toBeInTheDocument();
  });
});
