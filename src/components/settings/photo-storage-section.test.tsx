import { beforeEach, describe, expect, it } from "vitest";
import type { FamilyMember } from "@/lib/types";
import { seedMockPhotoStorage, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { PhotoStorageSection } from "./photo-storage-section";

setupMswServer();

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral", role: "PARENT", hasPin: true },
  { id: "maya", name: "Maya", color: "teal", role: "KID", hasPin: false },
];

async function tapPin(
  user: ReturnType<typeof renderWithUser>["user"],
  pin: string,
) {
  for (const digit of pin) {
    await user.click(screen.getByRole("button", { name: digit }));
  }
}

describe("PhotoStorageSection", () => {
  beforeEach(() => {
    seedFamilyStore({ name: "F", members: MEMBERS });
  });

  it("says where the photos are and where they may go", async () => {
    renderWithUser(<PhotoStorageSection />);
    expect(await screen.findByText("/photos/library")).toBeInTheDocument();
    expect(screen.getByText(/folder under \/photos/)).toBeInTheDocument();
  });

  it("moves the photos to a new folder after a parent's PIN", async () => {
    const { user } = renderWithUser(<PhotoStorageSection />);
    await user.click(
      await screen.findByRole("button", { name: "Move to another folder" }),
    );
    await user.type(screen.getByLabelText("New folder"), "/photos/nas");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Who is moving the photos?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mom" }));
    await tapPin(user, "2468");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Moved 0 photos to /photos/nas.",
    );
    expect(screen.getByText("/photos/nas")).toBeInTheDocument();
  });

  it("picks the new folder by tapping through the folders", async () => {
    const { user } = renderWithUser(<PhotoStorageSection />);
    await user.click(
      await screen.findByRole("button", { name: "Move to another folder" }),
    );
    for (const name of ["photos", "nas", "Photos"]) {
      await user.click(
        await screen.findByRole("button", { name, exact: true }),
      );
    }

    expect(screen.getByLabelText("New folder")).toHaveValue(
      "/photos/nas/Photos",
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Mom" }));
    await tapPin(user, "2468");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Moved 0 photos to /photos/nas/Photos.",
    );
  });

  it("shows the server's reason for a folder it will not use", async () => {
    const { user } = renderWithUser(<PhotoStorageSection />);
    await user.click(
      await screen.findByRole("button", { name: "Move to another folder" }),
    );
    await user.type(screen.getByLabelText("New folder"), "/etc/photos");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Mom" }));
    await tapPin(user, "2468");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Photos can go in a folder under /photos.",
    );
  });

  it("says when a move is running, and when the last one failed", async () => {
    seedMockPhotoStorage({ moving: true });
    const { unmount } = renderWithUser(<PhotoStorageSection />);
    expect(await screen.findByText(/moving the photos/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move to another folder" }),
    ).not.toBeInTheDocument();
    unmount();

    seedMockPhotoStorage({
      moving: false,
      lastMove: {
        to: "/photos/nas",
        moved: 0,
        error: "The photos could not be moved: disk full",
        finishedAt: "2026-10-27T18:00:00Z",
      },
    });
    renderWithUser(<PhotoStorageSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
  });
});
