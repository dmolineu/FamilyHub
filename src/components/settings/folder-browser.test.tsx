import { useState } from "react";
import { describe, expect, it } from "vitest";
import { setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen } from "@/test/test-utils";
import { FolderBrowser } from "./folder-browser";

setupMswServer();

/** Holds the chosen folder, as the photo settings' path field does. */
function Harness({ start = "" }: { start?: string }) {
  const [folder, setFolder] = useState(start);
  return (
    <>
      <p data-testid="chosen">{folder}</p>
      <FolderBrowser value={folder} onChange={setFolder} />
    </>
  );
}

const chosen = () => screen.getByTestId("chosen");

describe("FolderBrowser", () => {
  it("starts at the folders mounted for photos and goes in with a tap", async () => {
    const { user } = renderWithUser(<Harness />);

    await user.click(
      await screen.findByRole("button", { name: "photos", exact: true }),
    );
    expect(chosen()).toHaveTextContent("/photos");
    await user.click(
      await screen.findByRole("button", { name: "nas", exact: true }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Photos", exact: true }),
    );

    expect(chosen()).toHaveTextContent("/photos/nas/Photos");
    expect(
      await screen.findByText("96 photos in this folder"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "2026", exact: true }),
    ).toBeInTheDocument();
  });

  it("goes up a level, and from a root back to the start", async () => {
    const { user } = renderWithUser(<Harness start="/photos/nas/Photos" />);

    await user.click(await screen.findByRole("button", { name: /^Up/ }));
    expect(chosen()).toHaveTextContent("/photos/nas");
    await screen.findByRole("button", { name: "Photos", exact: true });
    await user.click(screen.getByRole("button", { name: /^Up/ }));
    await user.click(
      await screen.findByRole("button", { name: "nas", exact: true }),
    );
    expect(chosen()).toHaveTextContent("/photos/nas");
  });

  it("says when a folder holds no photos of its own", async () => {
    renderWithUser(<Harness start="/photos/nas" />);

    expect(
      await screen.findByText("No photos directly in this folder"),
    ).toBeInTheDocument();
  });

  it("says why a typed folder cannot be listed and offers the start", async () => {
    const { user } = renderWithUser(<Harness start="/nowhere" />);

    expect(
      await screen.findByText("The server can't find a folder at /nowhere."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Start from the top" }),
    );

    expect(chosen()).toHaveTextContent("");
    expect(
      await screen.findByRole("button", { name: "photos", exact: true }),
    ).toBeInTheDocument();
  });
});
