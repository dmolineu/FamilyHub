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

  it("shows each parent's picture on their face button", () => {
    seedFamilyStore({
      members: [{ ...MOM, avatarUrl: "builtin:owl" }, DAD, MAYA],
    });
    renderPad();
    const mom = screen.getByRole("button", { name: "Mom" });
    expect(mom.querySelector('svg[data-avatar-key="owl"]')).not.toBeNull();
  });

  it("checks the PIN the moment its fourth digit is tapped", async () => {
    const { user, onSubmit } = renderPad();

    await user.click(screen.getByRole("button", { name: "Mom" }));
    for (const digit of ["2", "4", "6"]) {
      await user.click(screen.getByRole("button", { name: digit }));
    }
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "8" }));

    // No button to press: the fourth digit sends it.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("mom", "2468");
  });

  it("checks a PIN typed on a keyboard without clicking into the field", async () => {
    const { user, onSubmit } = renderPad();

    await user.click(screen.getByRole("button", { name: "Mom" }));
    // Nothing focused: the keys still reach the pad.
    expect(screen.getByLabelText("Mom's PIN")).not.toHaveFocus();
    await user.keyboard("247{Backspace}");
    expect(screen.getByLabelText("Mom's PIN")).toHaveValue("24");
    await user.keyboard("68");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("mom", "2468");
  });

  it("checks a PIN typed into the field, as a phone keyboard does", async () => {
    const { user, onSubmit } = renderPad();

    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.type(screen.getByLabelText("Mom's PIN"), "2468");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("mom", "2468");
  });

  it("sends each PIN once, even when Enter follows the fourth digit", async () => {
    const { user, onSubmit } = renderPad();

    await user.click(screen.getByRole("button", { name: "Mom" }));
    for (const digit of ["2", "4", "6", "8"]) {
      await user.click(screen.getByRole("button", { name: digit }));
    }
    // The "8" key still has focus; a second send would cost a try.
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("takes four digits and ignores keys while the PIN is checked", async () => {
    const { user, onSubmit } = renderPad(
      vi.fn().mockReturnValue(new Promise(() => {})),
    );

    await user.click(screen.getByRole("button", { name: "Mom" }));
    expect(screen.getByLabelText("Mom's PIN")).toHaveAttribute(
      "maxlength",
      "4",
    );
    await user.keyboard("2468");
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
    await user.keyboard("1{Backspace}");
    await user.click(screen.getByRole("button", { name: "3" }));

    expect(screen.getByLabelText("Mom's PIN")).toHaveValue("2468");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("leaves typing in another field alone", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { user } = renderWithUser(
      <>
        <input aria-label="Reason" />
        <ParentPinPad
          prompt="Who is approving?"
          submitLabel="Approve"
          onSubmit={onSubmit}
        />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.click(screen.getByLabelText("Reason"));
    await user.keyboard("12{Enter}");

    expect(screen.getByLabelText("Reason")).toHaveValue("12");
    expect(screen.getByLabelText("Mom's PIN")).toHaveValue("");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's answer to a wrong PIN and clears the PIN", async () => {
    const { user } = renderPad(
      vi.fn().mockRejectedValue(new Error("Wrong PIN for Mom. 4 tries left.")),
    );

    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.type(screen.getByLabelText("Mom's PIN"), "0000");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wrong PIN for Mom. 4 tries left.",
    );
    expect(screen.getByLabelText("Mom's PIN")).toHaveValue("");
  });

  it("checks the next PIN as soon as it is entered after a wrong one", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Wrong PIN for Mom. 4 tries left."))
      .mockResolvedValueOnce(undefined);
    const { user } = renderPad(onSubmit);

    await user.click(screen.getByRole("button", { name: "Mom" }));
    await user.keyboard("0000");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.keyboard("2468");

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("mom", "2468");
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

    expect(screen.getByText(/No parent has set a PIN yet/)).toHaveTextContent(
      "tap their name in the menu",
    );
  });
});

describe("ParentPinPad password managers", () => {
  it("keeps a saved sign-in password out of the PIN field", async () => {
    seedFamilyStore({ members: [MOM] });
    const { user } = renderPad();

    await user.click(screen.getByRole("button", { name: "Mom" }));

    expect(screen.getByLabelText("Mom's PIN")).toHaveAttribute(
      "autocomplete",
      "one-time-code",
    );
  });
});
