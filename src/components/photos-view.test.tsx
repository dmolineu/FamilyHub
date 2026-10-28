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
  within,
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

  it("shows the photos from the family's folder beside the ones added here", async () => {
    seedMockPhotos([photo("p1")]);
    seedMockPhotoSource({ folder: "/photos/nas/Photos", photoCount: 3 }, [
      "f1",
      "f2",
      "f3",
    ]);
    renderWithUser(<PhotosView />);

    expect(
      await screen.findByRole("heading", { name: "From /photos/nas/Photos" }),
    ).toBeInTheDocument();
    const folder = screen.getByRole("list", {
      name: "From /photos/nas/Photos",
    });
    expect(
      await within(folder).findAllByRole("img", { name: /^photo-\d\.jpg, / }),
    ).toHaveLength(3);
    // The share is only ever read: no deleting its photos from here.
    expect(
      within(folder).queryByRole("button", { name: "Delete photo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Added here" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4 photos")).toBeInTheDocument();
    expect(screen.queryByText("No photos yet")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Family Settings → Photos from a folder/),
    ).not.toBeInTheDocument();
  });

  it("shows more of the folder's photos on request", async () => {
    const ids = Array.from({ length: 70 }, (_, i) => `f${i + 1}`);
    seedMockPhotoSource({ folder: "/photos/nas/Photos", photoCount: 70 }, ids);
    const { user } = renderWithUser(<PhotosView />);

    const folder = await screen.findByRole("list", {
      name: "From /photos/nas/Photos",
    });
    await waitFor(() =>
      expect(within(folder).getAllByRole("listitem")).toHaveLength(60),
    );
    await user.click(screen.getByRole("button", { name: "Show more photos" }));
    await waitFor(() =>
      expect(within(folder).getAllByRole("listitem")).toHaveLength(70),
    );
    expect(
      screen.queryByRole("button", { name: "Show more photos" }),
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
