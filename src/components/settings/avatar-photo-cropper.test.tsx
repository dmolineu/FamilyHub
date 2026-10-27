import { fireEvent } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { photoAvatar } from "@/lib/avatar-images";
import { renderWithUser, screen } from "@/test/test-utils";
import { AvatarPhotoCropper, CROP_VIEWPORT } from "./avatar-photo-cropper";

vi.mock("@/lib/avatar-images", () => ({
  photoAvatar: vi.fn(() => "data:image/jpeg;base64,CROPPED"),
}));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.mocked(photoAvatar).mockClear();
});

const photo = new File(["x"], "beach.jpg", { type: "image/jpeg" });

/** jsdom never loads images: give the photo a size and fire its load event. */
function loadPhoto(width: number, height: number) {
  const img = screen.getByTestId("crop-photo") as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", { value: width });
  Object.defineProperty(img, "naturalHeight", { value: height });
  fireEvent.load(img);
  return img;
}

describe("AvatarPhotoCropper", () => {
  it("saves the square the circle shows, centred at first", async () => {
    const onDone = vi.fn();
    const { user } = renderWithUser(
      <AvatarPhotoCropper file={photo} onDone={onDone} onCancel={vi.fn()} />,
    );
    const img = loadPhoto(400, 200);

    await user.click(screen.getByRole("button", { name: "Use this photo" }));

    // A 400×200 photo in the circle: its 200 px height fills it, centred.
    expect(photoAvatar).toHaveBeenCalledWith(img, {
      sx: 100,
      sy: 0,
      size: 200,
    });
    expect(onDone).toHaveBeenCalledWith("data:image/jpeg;base64,CROPPED");
    expect(CROP_VIEWPORT).toBeGreaterThanOrEqual(200);
  });

  it("zooms with buttons that work by touch, and the slider follows", async () => {
    const { user } = renderWithUser(
      <AvatarPhotoCropper file={photo} onDone={vi.fn()} onCancel={vi.fn()} />,
    );
    loadPhoto(400, 400);
    const slider = screen.getByRole("slider", { name: "Zoom" });
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(slider).toHaveValue("1");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(Number((slider as HTMLInputElement).value)).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Use this photo" }));
    const rect = vi.mocked(photoAvatar).mock.calls[0][1];
    expect(rect.size).toBeLessThan(400);
  });

  it("moves the photo with the arrow keys, never past its edge", async () => {
    const { user } = renderWithUser(
      <AvatarPhotoCropper file={photo} onDone={vi.fn()} onCancel={vi.fn()} />,
    );
    loadPhoto(400, 200);
    const area = screen.getByRole("group", { name: /photo position/i });

    area.focus();
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Use this photo" }));
    const moved = vi.mocked(photoAvatar).mock.calls[0][1];
    expect(moved.sx).toBeLessThan(100);

    area.focus();
    for (let i = 0; i < 40; i++) await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Use this photo" }));
    expect(vi.mocked(photoAvatar).mock.calls[1][1].sx).toBe(0);
  });

  it("explains a photo the browser cannot open, such as HEIC outside Safari", async () => {
    const onCancel = vi.fn();
    const { user } = renderWithUser(
      <AvatarPhotoCropper file={photo} onDone={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.error(screen.getByTestId("crop-photo"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be opened/i,
    );
    expect(
      screen.queryByRole("button", { name: "Use this photo" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
