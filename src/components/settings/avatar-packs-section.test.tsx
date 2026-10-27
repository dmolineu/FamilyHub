import { fireEvent } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AvatarPackDocument } from "@/lib/types";
import { seedMockAvatarPacks, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen, waitFor } from "@/test/test-utils";
import { AvatarPacksSection } from "./avatar-packs-section";

setupMswServer();

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:pack");
  URL.revokeObjectURL = vi.fn();
});

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const PACK: AvatarPackDocument = {
  version: 1,
  name: "Characters",
  characters: [
    { key: "pikachu", name: "Pikachu", group: "Pokémon", image: PNG },
    { key: "yoda", name: "Yoda", group: "Star Wars", image: PNG },
    { key: "eevee", name: "Eevee", group: "Pokémon", image: PNG },
  ],
};

function pickFile(contents: string, name = "characters.familyavatars.json") {
  const input = screen.getByLabelText("Import a character pack file");
  fireEvent.change(input, {
    target: {
      files: [new File([contents], name, { type: "application/json" })],
    },
  });
}

describe("AvatarPacksSection", () => {
  it("lists each pack with its characters and groups", async () => {
    seedMockAvatarPacks([PACK]);
    renderWithUser(<AvatarPacksSection />);
    expect(await screen.findByText("Characters")).toBeInTheDocument();
    expect(
      screen.getByText("3 characters · Pokémon, Star Wars"),
    ).toBeInTheDocument();
  });

  it("imports a pack file and lists it", async () => {
    renderWithUser(<AvatarPacksSection />);
    expect(
      await screen.findByText(/no character packs yet/i),
    ).toBeInTheDocument();

    pickFile(JSON.stringify(PACK));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Imported Characters (3 characters).",
    );
    expect(screen.getByText("Characters")).toBeInTheDocument();
  });

  it("refuses a file that is not a character pack", async () => {
    renderWithUser(<AvatarPacksSection />);
    pickFile('{"version": 1, "name": "Padres", "tokens": {}}');
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That is not a character pack file.",
    );
  });

  it("shows the server's reason when an import is refused", async () => {
    seedMockAvatarPacks([PACK]);
    renderWithUser(<AvatarPacksSection />);
    await screen.findByText("Characters");
    pickFile(JSON.stringify(PACK));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already exists/,
    );
  });

  it("asks before deleting and says chosen pictures stay", async () => {
    seedMockAvatarPacks([PACK]);
    const { user } = renderWithUser(<AvatarPacksSection />);
    await user.click(
      await screen.findByRole("button", { name: "Delete Characters" }),
    );
    expect(
      screen.getByText(/members who chose one of its characters keep/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete pack" }));

    await waitFor(() =>
      expect(screen.queryByText("Characters")).not.toBeInTheDocument(),
    );
  });

  it("downloads a pack as the same file", async () => {
    seedMockAvatarPacks([PACK]);
    const { user } = renderWithUser(<AvatarPacksSection />);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await user.click(
      await screen.findByRole("button", { name: "Download Characters" }),
    );

    await waitFor(() => expect(click).toHaveBeenCalled());
    const link = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(link.download).toBe("characters.familyavatars.json");
    click.mockRestore();
  });
});
