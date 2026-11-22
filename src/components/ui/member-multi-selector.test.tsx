import { describe, expect, it, vi } from "vitest";
import { testMembers } from "@/test/fixtures";
import { renderWithUser, screen } from "@/test/test-utils";
import { MemberMultiSelector, toggleMember } from "./member-multi-selector";

// An event can belong to several people (Phase 4). The first one picked leads: the
// event takes their colour. In add mode the form's pick is only a guess, so the first
// tap replaces it; after that, and always in edit mode, a tap adds or removes.

const [john, jane, alex] = testMembers.map((member) => member.id);

describe("toggleMember", () => {
  it("adds a person after the ones already chosen and removes a chosen one", () => {
    expect(toggleMember([john], jane)).toEqual([john, jane]);
    expect(toggleMember([john, jane, alex], jane)).toEqual([john, alex]);
  });

  it("makes the next person lead when the lead is removed", () => {
    expect(toggleMember([john, jane], john)).toEqual([jane]);
  });

  it("never leaves the event with no one", () => {
    expect(toggleMember([john], john)).toEqual([john]);
  });

  it("replaces a guessed pick with the first one tapped", () => {
    expect(toggleMember([john], jane, { replace: true })).toEqual([jane]);
    expect(toggleMember([john], john, { replace: true })).toEqual([john]);
  });
});

describe("MemberMultiSelector", () => {
  it("shows every chosen person as pressed and reports a tap", async () => {
    const onChange = vi.fn();
    const { user } = renderWithUser(
      <MemberMultiSelector
        members={testMembers}
        value={[jane, john]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("button", { name: "John" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Jane" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Alex" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Alex" }));
    expect(onChange).toHaveBeenLastCalledWith([jane, john, alex]);
  });

  it("replaces the guessed pick on the first tap only", async () => {
    const onChange = vi.fn();
    const { user, rerender } = renderWithUser(
      <MemberMultiSelector
        members={testMembers}
        value={[john]}
        onChange={onChange}
        replaceUntilTouched
      />,
    );

    await user.click(screen.getByRole("button", { name: "Jane" }));
    expect(onChange).toHaveBeenLastCalledWith([jane]);

    rerender(
      <MemberMultiSelector
        members={testMembers}
        value={[jane]}
        onChange={onChange}
        replaceUntilTouched
      />,
    );
    await user.click(screen.getByRole("button", { name: "Alex" }));
    expect(onChange).toHaveBeenLastCalledWith([jane, alex]);
  });
});
