import { fireEvent } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { characterAvatar } from "@/lib/avatar-images";
import type { AvatarPackDocument, FamilyMember } from "@/lib/types";
import { seedMockAvatarPacks, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen } from "@/test/test-utils";
import { AvatarPicker } from "./avatar-picker";

vi.mock("@/lib/avatar-images", () => ({
  characterAvatar: vi.fn(async () => "data:image/png;base64,SMALL"),
  photoAvatar: vi.fn(() => "data:image/jpeg;base64,CROPPED"),
}));

setupMswServer();

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.mocked(characterAvatar).mockClear();
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

const maya: FamilyMember = { id: "m1", name: "Maya", color: "teal" };

describe("AvatarPicker", () => {
  it("groups the family's characters and saves a small copy of the chosen one", async () => {
    seedMockAvatarPacks([PACK]);
    const onChoose = vi.fn();
    const { user } = renderWithUser(
      <AvatarPicker member={maya} onChoose={onChoose} onBack={vi.fn()} />,
    );

    const pokemon = await screen.findByRole("region", { name: "Pokémon" });
    expect(
      screen.getByRole("region", { name: "Star Wars" }),
    ).toBeInTheDocument();
    expect(
      Array.from(pokemon.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(["Pikachu", "Eevee"]);

    await user.click(screen.getByRole("button", { name: "Yoda" }));

    expect(characterAvatar).toHaveBeenCalledWith(PNG);
    expect(onChoose).toHaveBeenCalledWith("data:image/png;base64,SMALL");
  });

  it("offers the built-in pictures and marks the current one", async () => {
    const onChoose = vi.fn();
    const { user } = renderWithUser(
      <AvatarPicker
        member={{ ...maya, avatarUrl: "builtin:owl" }}
        onChoose={onChoose}
        onBack={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Pictures" }));

    expect(screen.getByRole("button", { name: "Owl" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Fox" }));
    expect(onChoose).toHaveBeenCalledWith("builtin:fox");
  });

  it("says where characters come from when the family has no packs", async () => {
    const { user } = renderWithUser(
      <AvatarPicker member={maya} onChoose={vi.fn()} onBack={vi.fn()} />,
    );
    await user.click(screen.getByRole("tab", { name: "Characters" }));
    expect(
      await screen.findByText(/a parent can import a character pack/i),
    ).toBeInTheDocument();
  });

  it("goes back to initials", async () => {
    const onChoose = vi.fn();
    const { user } = renderWithUser(
      <AvatarPicker
        member={{ ...maya, avatarUrl: "builtin:fox" }}
        onChoose={onChoose}
        onBack={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Use initials" }));
    expect(onChoose).toHaveBeenCalledWith(null);
  });

  it("opens the cropper for a chosen photo and refuses other files", async () => {
    const { user } = renderWithUser(
      <AvatarPicker member={maya} onChoose={vi.fn()} onBack={vi.fn()} />,
    );
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const input = screen.getByLabelText("Choose a photo");

    // The file input's accept filter would drop a text file; fire the change directly.
    fireEvent.change(input, {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/choose a photo/i);

    fireEvent.change(input, {
      target: { files: [new File(["x"], "me.jpg", { type: "image/jpeg" })] },
    });
    expect(
      screen.getByRole("group", { name: /photo position/i }),
    ).toBeInTheDocument();
  });

  it("goes back without choosing", async () => {
    const onBack = vi.fn();
    const { user } = renderWithUser(
      <AvatarPicker member={maya} onChoose={vi.fn()} onBack={onBack} />,
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });
});
