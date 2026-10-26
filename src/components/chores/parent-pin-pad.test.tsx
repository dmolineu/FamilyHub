import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyMember } from "@/lib/types";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { ParentPinPad } from "./parent-pin-pad";

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
  hasPin: false,
};
const MAYA: FamilyMember = {
  id: "maya",
  name: "Maya",
  color: "teal",
  role: "KID",
  hasPin: false,
};

function renderPad(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  return {
    onSubmit,
    ...renderWithUser(
      <ParentPinPad
        prompt="Who is approving?"
        submitLabel="Approve"
        onSubmit={onSubmit}
      />,
    ),
  };
}

describe("ParentPinPad", () => {
  beforeEach(() => {
    seedFamilyStore({ members: [MOM, DAD, MAYA] });
  });

  it("starts with the faces of the parents who have a PIN", () => {
    renderPad();

    expect(screen.getByText("Who is approving?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mom" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Maya" }),
    ).not.toBeInTheDocument();
    // Dad cannot approve until he sets a PIN, and the pad says so.
    expect(
      screen.queryByRole("button", { name: "Dad" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Dad hasn't set a PIN yet/)).toBeInTheDocument();
  });

  it("sends the chosen parent and the PIN tapped on the keypad", async () => {
    const { user, onSubmit } = renderPad();

    await user.click(screen.getByRole("button", { name: "Mom" }));
    for (const digit of ["2", "4", "6", "8"]) {
      await user.click(screen.getByRole("button", { name: digit }));
    }
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(onSubmit).toHaveBeenCalledWith("mom", "2468");
  });

  it("shows the server's answer to a wrong PIN and clears the PIN", async () => {
    const { user } = renderPad(
      vi.fn().mockRejectedValue(new Error("Wrong PIN for Mom. 4 tries left.")),
    );

    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.type(screen.getByLabelText("Mom's PIN"), "0000");
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wrong PIN for Mom. 4 tries left.",
    );
    expect(screen.getByLabelText("Mom's PIN")).toHaveValue("");
  });

  it("keeps the send button off until the PIN has four digits", async () => {
    const { user } = renderPad();

    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.type(screen.getByLabelText("Mom's PIN"), "246");

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("says how to get started when no parent has a PIN", () => {
    seedFamilyStore({ members: [DAD, MAYA] });
    renderPad();

    expect(screen.getByText(/No parent has set a PIN yet/)).toBeInTheDocument();
  });
});
