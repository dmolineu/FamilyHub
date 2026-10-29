import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamilyMembers } from "@/api";
import { ParentPinPad } from "@/components/chores/parent-pin-pad";
import { ParentSessionContext } from "@/components/chores/parent-session";
import type { FamilyMember } from "@/lib/types";
import { useScreensaverStore } from "@/stores";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import {
  act,
  renderWithUser,
  screen,
  seedFamilyStore,
} from "@/test/test-utils";
import { PARENT_LOCK_IDLE_MS, ParentLock } from "./parent-lock";

setupMswServer();

/** The PIN the mock server accepts. */
const PIN = "2468";

const MOM: FamilyMember = {
  id: "mom",
  name: "Mom",
  color: "coral",
  role: "PARENT",
  hasPin: true,
};
const DAD: FamilyMember = {
  id: "dad",
  name: "Dad",
  color: "green",
  role: "PARENT",
};
const MAYA: FamilyMember = {
  id: "maya",
  name: "Maya",
  color: "teal",
  role: "KID",
};

type User = ReturnType<typeof renderWithUser>["user"];

async function unlockAsMom(user: User, pin = PIN) {
  await user.click(screen.getByRole("button", { name: "Mom", exact: true }));
  for (const digit of pin) {
    await user.click(screen.getByRole("button", { name: digit, exact: true }));
  }
}

function Guarded({ isOpen = true, onLock = vi.fn() }) {
  return (
    <ParentLock
      isOpen={isOpen}
      prompt="Who is changing settings?"
      onLock={onLock}
    >
      <p>The family's settings</p>
    </ParentLock>
  );
}

describe("ParentLock", () => {
  beforeEach(() => {
    seedFamilyStore({ name: "F", members: [MOM, DAD, MAYA] });
    useScreensaverStore.setState({ isActive: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows what it guards only after a parent's face and PIN", async () => {
    const { user } = renderWithUser(<Guarded />);

    expect(screen.queryByText("The family's settings")).not.toBeInTheDocument();
    expect(screen.getByText("Who is changing settings?")).toBeInTheDocument();
    // Kids have no PIN to offer.
    expect(
      screen.queryByRole("button", { name: "Maya", exact: true }),
    ).not.toBeInTheDocument();

    await unlockAsMom(user);

    expect(
      await screen.findByText("The family's settings"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Unlocked by Mom/)).toBeInTheDocument();
  });

  it("stays locked after a wrong PIN and says why", async () => {
    const { user } = renderWithUser(<Guarded />);

    await unlockAsMom(user, "1111");

    expect(
      await screen.findByText("Wrong PIN for Mom. 4 tries left."),
    ).toBeInTheDocument();
    expect(screen.queryByText("The family's settings")).not.toBeInTheDocument();
  });

  it("asks the server, so the PIN is checked and counted there", async () => {
    const sent: unknown[] = [];
    server.use(
      http.post(`${API_BASE}/family/unlock`, async ({ request }) => {
        sent.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderWithUser(<Guarded />);

    await unlockAsMom(user);

    await screen.findByText("The family's settings");
    expect(sent).toEqual([{ approverMemberId: "mom", pin: PIN }]);
  });

  it("locks again after 2 minutes without a tap, but not while someone is using it", async () => {
    const onLock = vi.fn();
    const { user } = renderWithUser(<Guarded onLock={onLock} />);
    await unlockAsMom(user);
    await screen.findByText("The family's settings");
    vi.useFakeTimers({ shouldAdvanceTime: true });

    act(() => vi.advanceTimersByTime(PARENT_LOCK_IDLE_MS - 30_000));
    await user.click(screen.getByText("The family's settings"));
    act(() => vi.advanceTimersByTime(PARENT_LOCK_IDLE_MS - 30_000));
    expect(screen.getByText("The family's settings")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.queryByText("The family's settings")).not.toBeInTheDocument();
    expect(screen.getByText(/Locked after 2 minutes/)).toBeInTheDocument();
    expect(onLock).toHaveBeenCalled();
  });

  it("locks when the screensaver starts", async () => {
    const { user } = renderWithUser(<Guarded />);
    await unlockAsMom(user);
    await screen.findByText("The family's settings");

    act(() => useScreensaverStore.setState({ isActive: true }));

    expect(screen.queryByText("The family's settings")).not.toBeInTheDocument();
    expect(screen.getByText(/screensaver/i)).toBeInTheDocument();
  });

  it("locks when it is closed, so the next person is asked again", async () => {
    const onLock = vi.fn();
    const { user, rerender } = renderWithUser(<Guarded onLock={onLock} />);
    await unlockAsMom(user);
    await screen.findByText("The family's settings");

    rerender(<Guarded isOpen={false} onLock={onLock} />);
    rerender(<Guarded isOpen onLock={onLock} />);

    expect(screen.queryByText("The family's settings")).not.toBeInTheDocument();
    expect(onLock).toHaveBeenCalled();
  });

  it("locks at once with its Lock button", async () => {
    const { user } = renderWithUser(<Guarded />);
    await unlockAsMom(user);
    await screen.findByText("The family's settings");

    await user.click(screen.getByRole("button", { name: "Lock" }));

    expect(screen.queryByText("The family's settings")).not.toBeInTheDocument();
  });

  it("stays open, and says how to lock it, while no parent has a PIN", () => {
    seedFamilyStore({
      name: "F",
      members: [{ ...MOM, hasPin: false }, DAD, MAYA],
    });
    renderWithUser(<Guarded />);

    expect(screen.getByText("The family's settings")).toBeInTheDocument();
    expect(screen.getByText(/no parent has set a PIN/i)).toBeInTheDocument();
  });

  it("lets a PIN step inside it go ahead as the parent who unlocked, without asking again", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { user } = renderWithUser(
      <ParentLock isOpen prompt="Who is changing settings?">
        <ParentPinPad
          prompt="Who is moving the photos?"
          submitLabel="Move photos"
          onSubmit={onSubmit}
        />
      </ParentLock>,
    );
    await unlockAsMom(user);

    expect(await screen.findByText(/as Mom/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move photos" }));

    expect(onSubmit).toHaveBeenCalledWith("mom", PIN);
  });

  it("for one member, asks for that parent's own PIN and offers nobody else", async () => {
    seedFamilyStore({
      name: "F",
      members: [MOM, { ...DAD, hasPin: true }, MAYA],
    });
    const sent: unknown[] = [];
    server.use(
      http.post(`${API_BASE}/family/unlock`, async ({ request }) => {
        sent.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderWithUser(
      <ParentLock isOpen memberId="mom" prompt="Who is opening this?">
        <p>Mom's profile</p>
      </ParentLock>,
    );

    // Straight to Mom's PIN: no faces to pick from and no way to switch to Dad.
    expect(screen.getByLabelText("Mom's PIN")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dad", exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Not Mom/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Mom's profile")).not.toBeInTheDocument();

    for (const digit of PIN) {
      await user.click(
        screen.getByRole("button", { name: digit, exact: true }),
      );
    }

    expect(await screen.findByText("Mom's profile")).toBeInTheDocument();
    expect(sent).toEqual([{ approverMemberId: "mom", pin: PIN }]);
  });

  it("for one member, does not go ahead as another parent who unlocked the screen around it", () => {
    seedFamilyStore({
      name: "F",
      members: [MOM, { ...DAD, hasPin: true }, MAYA],
    });
    renderWithUser(
      <ParentSessionContext.Provider
        value={{ approverMemberId: "dad", approverName: "Dad", pin: PIN }}
      >
        <ParentLock isOpen memberId="mom" prompt="Who is opening this?">
          <p>Mom's profile</p>
        </ParentLock>
      </ParentSessionContext.Provider>,
    );

    expect(screen.getByLabelText("Mom's PIN")).toBeInTheDocument();
    expect(screen.queryByText(/as Dad/)).not.toBeInTheDocument();
  });

  it("for a member without a PIN, shows what it guards at once and says nothing", () => {
    for (const memberId of ["dad", "maya"]) {
      const { unmount } = renderWithUser(
        <ParentLock isOpen memberId={memberId} prompt="Who is opening this?">
          <p>The profile</p>
        </ParentLock>,
      );
      expect(screen.getByText("The profile")).toBeInTheDocument();
      expect(screen.queryByText(/PIN/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("for one member, settles whether to ask when it opens, so a first PIN set inside does not lock it", async () => {
    function DadsProfile({ isOpen }: { isOpen: boolean }) {
      // Shows when the screen has caught up with the family's data.
      const dad = useFamilyMembers().find((member) => member.id === "dad");
      return (
        <>
          {dad?.hasPin && <span>Dad has a PIN now</span>}
          <ParentLock isOpen={isOpen} memberId="dad" prompt="Who is opening?">
            <p>Dad's profile</p>
          </ParentLock>
        </>
      );
    }
    const { rerender } = renderWithUser(<DadsProfile isOpen />);
    expect(screen.getByText("Dad's profile")).toBeInTheDocument();

    act(() => {
      seedFamilyStore({
        name: "F",
        members: [MOM, { ...DAD, hasPin: true }, MAYA],
      });
    });
    await screen.findByText("Dad has a PIN now");
    expect(screen.getByText("Dad's profile")).toBeInTheDocument();

    rerender(<DadsProfile isOpen={false} />);
    rerender(<DadsProfile isOpen />);
    expect(screen.queryByText("Dad's profile")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Dad's PIN")).toBeInTheDocument();
  });

  it("asks for a PIN again when the unlocked parent's PIN is refused", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new Error("Mom's PIN is locked after too many wrong tries."),
      );
    const { user } = renderWithUser(
      <ParentLock isOpen prompt="Who is changing settings?">
        <ParentPinPad
          prompt="Who is moving the photos?"
          submitLabel="Move photos"
          onSubmit={onSubmit}
        />
      </ParentLock>,
    );
    await unlockAsMom(user);
    await user.click(
      await screen.findByRole("button", { name: "Move photos" }),
    );

    expect(
      await screen.findByText(/locked after too many wrong tries/),
    ).toBeInTheDocument();
    expect(screen.getByText("Who is moving the photos?")).toBeInTheDocument();
  });
});
