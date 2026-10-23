import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  TEST_TIMEOUTS,
  typeAndWait,
  waitFor,
  waitForMemberSelected,
} from "@/test/test-utils";
import { ChoreForm } from "./chore-form";

describe("ChoreForm", () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    seedFamilyStore({
      members: [
        { id: "member-1", name: "Leo", color: "coral" },
        { id: "member-2", name: "Maya", color: "teal" },
      ],
    });
  });

  it("submits title, assignee, and cadence", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{
          assignedToMemberIds: ["member-1"],
          cadence: "WEEKLY",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    await waitForMemberSelected("Leo");
    await typeAndWait(
      user,
      screen.getByLabelText(/chore name/i),
      "Take out trash",
    );
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Take out trash",
          assignedToMemberIds: ["member-1"],
          cadence: "WEEKLY",
        });
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );
  });

  it("focuses the chore name so typing can start at once", () => {
    renderWithUser(<ChoreForm onSubmit={onSubmit} onCancel={onCancel} />);

    expect(screen.getByLabelText(/chore name/i)).toHaveFocus();
  });

  it("starts with Anyone and lets several members toggle on and off", async () => {
    const { user } = renderWithUser(
      <ChoreForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    expect(screen.getByRole("button", { name: "Anyone" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Leo" }));
    await user.click(screen.getByRole("button", { name: "Maya" }));
    expect(screen.getByRole("button", { name: "Anyone" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Leo" }));
    await waitForMemberSelected("Maya");

    await typeAndWait(user, screen.getByLabelText(/chore name/i), "Dishes");
    await user.click(screen.getByRole("button", { name: /save chore/i }));

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Dishes",
          assignedToMemberIds: ["member-2"],
          cadence: "DAILY",
        });
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );
  });

  it("submits a chore for anyone when no member is selected", async () => {
    const { user } = renderWithUser(
      <ChoreForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await typeAndWait(
      user,
      screen.getByLabelText(/chore name/i),
      "Feed the dog",
    );
    await user.click(screen.getByRole("button", { name: /save chore/i }));

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Feed the dog",
          assignedToMemberIds: [],
          cadence: "DAILY",
        });
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );
  });

  it("shows validation errors for required fields", async () => {
    const { user } = renderWithUser(
      <ChoreForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /save chore/i }));

    expect(screen.getByText("Chore name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves entered values when equivalent defaults rerender", async () => {
    const { user, rerender } = renderWithUser(
      <ChoreForm
        defaultValues={{ assignedToMemberIds: ["member-1"], cadence: "DAILY" }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    await waitForMemberSelected("Leo");
    await typeAndWait(
      user,
      screen.getByLabelText(/chore name/i),
      "Take out trash",
    );

    rerender(
      <ChoreForm
        defaultValues={{ assignedToMemberIds: ["member-1"], cadence: "DAILY" }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText(/chore name/i)).toHaveValue("Take out trash");
  });

  it("calls onCancel from the secondary action", async () => {
    const { user } = renderWithUser(
      <ChoreForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
