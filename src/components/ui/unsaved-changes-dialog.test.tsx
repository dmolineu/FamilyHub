import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithUser, screen } from "@/test/test-utils";
import { useUnsavedChangesGuard } from "./unsaved-changes-dialog";

function Harness({
  dirty,
  onClose,
  onDiscard,
}: {
  dirty: boolean;
  onClose: () => void;
  onDiscard?: () => void;
}) {
  const [isDirty] = useState(dirty);
  const guard = useUnsavedChangesGuard({ isDirty, onClose, onDiscard });
  return (
    <>
      <button type="button" onClick={guard.requestClose}>
        Leave
      </button>
      {guard.dialog}
    </>
  );
}

describe("useUnsavedChangesGuard", () => {
  it("closes at once when nothing has changed", async () => {
    const onClose = vi.fn();
    const { user } = renderWithUser(
      <Harness dirty={false} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: "Leave" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks first when there are unsaved changes, and Keep editing stays", async () => {
    const onClose = vi.fn();
    const { user } = renderWithUser(<Harness dirty onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Leave" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Discard unsaved changes?",
    });
    expect(dialog).toHaveTextContent(
      "Your changes haven't been saved. If you leave now, they'll be lost.",
    );
    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
  });

  it("discards and closes when asked to", async () => {
    const onClose = vi.fn();
    const onDiscard = vi.fn();
    const { user } = renderWithUser(
      <Harness dirty onClose={onClose} onDiscard={onDiscard} />,
    );

    await user.click(screen.getByRole("button", { name: "Leave" }));
    await user.click(
      await screen.findByRole("button", { name: "Discard changes" }),
    );

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("asks the browser to confirm a reload or tab close while changes are unsaved", () => {
    renderWithUser(<Harness dirty onClose={vi.fn()} />);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves reloads alone when nothing has changed", () => {
    renderWithUser(<Harness dirty={false} onClose={vi.fn()} />);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
