import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { FamilyMember, PhotoSourceRequest } from "@/lib/types";
import {
  API_BASE,
  seedMockPhotoSource,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { PhotoSourceSection } from "./photo-source-section";

setupMswServer();

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral", role: "PARENT", hasPin: true },
];

async function tapPin(
  user: ReturnType<typeof renderWithUser>["user"],
  pin: string,
) {
  for (const digit of pin) {
    await user.click(screen.getByRole("button", { name: digit, exact: true }));
  }
}

describe("PhotoSourceSection", () => {
  let requests: PhotoSourceRequest[];

  beforeEach(() => {
    seedFamilyStore({ name: "F", members: MEMBERS });
    requests = [];
    server.use(
      http.put(`${API_BASE}/photos/source`, async ({ request }) => {
        const body = (await request.json()) as PhotoSourceRequest;
        requests.push(body);
        return HttpResponse.json(
          {
            data: {
              folder: body.folder || null,
              photoCount: 0,
              skippedHeic: 0,
              indexing: body.folder !== "",
              lastIndexedAt: null,
              error: null,
            },
            message: "",
          },
          { status: 202 },
        );
      }),
    );
  });

  it("says when no folder of existing photos is shown", async () => {
    renderWithUser(<PhotoSourceSection />);
    expect(
      await screen.findByText(/not showing a folder of existing photos/i),
    ).toBeInTheDocument();
  });

  it("chooses a folder with a parent's PIN and shows it being read", async () => {
    const { user } = renderWithUser(<PhotoSourceSection />);
    await user.click(
      await screen.findByRole("button", { name: "Choose a folder" }),
    );
    await user.type(
      screen.getByLabelText("Folder of photos"),
      "/photos/nas/Photos",
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Mom", exact: true }));
    await tapPin(user, "2468");
    await user.click(screen.getByRole("button", { name: "Show these photos" }));

    expect(requests).toEqual([
      { approverMemberId: "mom", pin: "2468", folder: "/photos/nas/Photos" },
    ]);
    expect(await screen.findByText(/reading the folder/i)).toBeInTheDocument();
  });

  it("chooses the folder by tapping through the folders", async () => {
    const { user } = renderWithUser(<PhotoSourceSection />);
    await user.click(
      await screen.findByRole("button", { name: "Choose a folder" }),
    );
    for (const name of ["photos", "nas", "Photos"]) {
      await user.click(
        await screen.findByRole("button", { name, exact: true }),
      );
    }
    expect(
      await screen.findByText("96 photos in this folder"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Mom", exact: true }));
    await tapPin(user, "2468");
    await user.click(screen.getByRole("button", { name: "Show these photos" }));

    expect(requests).toEqual([
      { approverMemberId: "mom", pin: "2468", folder: "/photos/nas/Photos" },
    ]);
  });

  it("counts the pictures and says why HEIC ones are missing", async () => {
    seedMockPhotoSource({
      folder: "/photos/nas/Photos",
      photoCount: 1234,
      skippedHeic: 3,
      lastIndexedAt: "2026-10-27T11:15:00Z",
    });
    renderWithUser(<PhotoSourceSection />);
    expect(await screen.findByText("/photos/nas/Photos")).toBeInTheDocument();
    expect(
      screen.getByText(/1,234 photos in the slideshow/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 HEIC photos are not shown/i),
    ).toBeInTheDocument();
  });

  it("stops showing the folder with a parent's PIN", async () => {
    seedMockPhotoSource({ folder: "/photos/nas/Photos", photoCount: 10 });
    const { user } = renderWithUser(<PhotoSourceSection />);
    await user.click(
      await screen.findByRole("button", { name: "Stop showing" }),
    );
    await user.click(screen.getByRole("button", { name: "Mom", exact: true }));
    await tapPin(user, "2468");
    await user.click(screen.getByRole("button", { name: "Stop showing them" }));

    expect(requests).toEqual([
      { approverMemberId: "mom", pin: "2468", folder: "" },
    ]);
  });

  it("shows why the folder could not be read", async () => {
    seedMockPhotoSource({
      folder: "/photos/nas/Photos",
      error: "The folder could not be read: permission denied",
    });
    renderWithUser(<PhotoSourceSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "permission denied",
    );
  });
});
