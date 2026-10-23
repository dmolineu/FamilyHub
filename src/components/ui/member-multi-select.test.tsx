import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FamilyMember } from "@/lib/types";
import { MemberMultiSelect } from "./member-multi-select";

const members: FamilyMember[] = [
  { id: "member-1", name: "Leo", color: "coral" },
  { id: "member-2", name: "Maya", color: "teal" },
];

describe("MemberMultiSelect", () => {
  it("marks Anyone as pressed when nothing is selected", () => {
    render(
      <MemberMultiSelect members={members} value={[]} onChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Anyone" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Leo" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles a member on and off and keeps the others", async () => {
    const onChange = vi.fn();
    render(
      <MemberMultiSelect
        members={members}
        value={["member-1"]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Maya" }));
    expect(onChange).toHaveBeenLastCalledWith(["member-1", "member-2"]);

    await userEvent.click(screen.getByRole("button", { name: "Leo" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("clears the selection when Anyone is chosen", async () => {
    const onChange = vi.fn();
    render(
      <MemberMultiSelect
        members={members}
        value={["member-1", "member-2"]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Anyone" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
