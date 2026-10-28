import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Photo } from "@/lib/types";
import { useScreensaverStore } from "@/stores";
import {
  getMockPhotos,
  seedMockPhotoSource,
  seedMockPhotos,
  setupMswServer,
} from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
} from "@/test/test-utils";
import { PhotosView } from "./photos-view";

const prepare = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prepare-photo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/prepare-photo")>()),
  preparePhotoForUpload: prepare,
}));

setupMswServer();

beforeAll(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:thumb-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

function photo(id: string): Photo {
  return {
    id,
    contentType: "image/jpeg",
    width: 1920,
    height: 1080,
    sizeBytes: 1000,
    createdAt: "2026-10-25T20:00:00Z",
  };
}

describe("PhotosView", () => {
  beforeEach(() => {
    seedFamilyStore({ members: [{ id: "m1", name: "Mom", color: "coral" }] });
    prepare.mockReset();
    prepare.mockImplementation(
      async (file: File) => new Blob([file.name], { type: "image/jpeg" }),
    );
  });

  it("shows the family's photos as thumbnails", async () => {
    seedMockPhotos([photo("p1"), photo("p2")]);
    renderWithUser(<PhotosView />);

    const thumbs = await screen.findAllByRole("img", { name: /^Added / });
    expect(thumbs).toHaveLength(2);
    expect(screen.getByText("2 photos")).toBeInTheDocument();
  });

  it("explains what photos are for when there are none", async () => {
    renderWithUser(<PhotosView />);

    expect(
      await screen.findByText(/Add photos to show them on the screensaver/),
    ).toBeInTheDocument();
  });

  it("says where to choose a folder of photos the family already has", async () => {
    renderWithUser(<PhotosView />);

    expect(
      await screen.findByText(/Family Settings → Photos from a folder/),
    ).toBeInTheDocument();
  });

  it("says the slideshow also shows the photos from the family's folder", async () => {
    seedMockPhotoSource({ folder: "/photos/nas/Photos", photoCount: 96 });
    renderWithUser(<PhotosView />);

    // Nothing uploaded, but the folder's photos are in the slideshow already.
    expect(
      await screen.findByText(
        "The slideshow also shows 96 photos from /photos/nas/Photos.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("No photos yet")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Family Settings → Photos from a folder/),
    ).not.toBeInTheDocument();
  });

  it("says when the family's folder is still being read", async () => {
    seedMockPhotoSource({
      folder: "/photos/nas/Photos",
      photoCount: 12,
      indexing: true,
    });
    renderWithUser(<PhotosView />);

    expect(
      await screen.findByText("Reading the photos in /photos/nas/Photos…"),
    ).toBeInTheDocument();
  });

  it("shrinks and uploads each chosen photo", async () => {
    const { user } = renderWithUser(<PhotosView />);

    await user.upload(screen.getByLabelText("Add photos"), [
      new File(["a"], "beach.jpg", { type: "image/jpeg" }),
      new File(["b"], "party.png", { type: "image/png" }),
    ]);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Added 2 photos.",
    );
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(getMockPhotos()).toHaveLength(2);
  });

  it("names a photo that could not be added and keeps going", async () => {
    prepare.mockImplementation(async (file: File) => {
      if (file.name.endsWith(".heic")) {
        throw new Error("This browser can't open that kind of photo.");
      }
      return new Blob([file.name], { type: "image/jpeg" });
    });
    const { user } = renderWithUser(<PhotosView />);

    await user.upload(screen.getByLabelText("Add photos"), [
      new File(["a"], "IMG_1.heic", { type: "image/heic" }),
      new File(["b"], "beach.jpg", { type: "image/jpeg" }),
    ]);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Added 1 photo.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "IMG_1.heic: This browser can't open that kind of photo.",
    );
  });

  it("deletes a photo after asking", async () => {
    seedMockPhotos([photo("p1"), photo("p2")]);
    const { user } = renderWithUser(<PhotosView />);

    const deletes = await screen.findAllByRole("button", {
      name: "Delete photo",
    });
    await user.click(deletes[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(getMockPhotos().map((p) => p.id)).toEqual(["p2"]),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("img", { name: /^Added / })).toHaveLength(1),
    );
  });

  it("starts the slideshow on demand", async () => {
    seedMockPhotos([photo("p1")]);
    const { user } = renderWithUser(<PhotosView />);

    await user.click(
      await screen.findByRole("button", { name: "Start slideshow" }),
    );

    expect(useScreensaverStore.getState().isActive).toBe(true);
  });
});
