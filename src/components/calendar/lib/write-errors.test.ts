import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorCode, ApiException } from "@/api/client";
import { notifyCalendarWriteError } from "./write-errors";

const mockToast = vi.fn();
vi.mock("@/components/ui/toaster", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Phase 4: a change goes to Google first, so it can be refused for reasons the family
// can act on (changed in Google meanwhile, sign in again, Google down). The API's
// message says which; it is shown rather than dropped.
describe("notifyCalendarWriteError", () => {
  beforeEach(() => {
    mockToast.mockReset();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("says offline when the device is offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    notifyCalendarWriteError(
      new ApiException({
        code: ApiErrorCode.NETWORK_ERROR,
        message: "Failed to fetch",
        status: 0,
      }),
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "You're offline" }),
    );
  });

  it("shows why Google refused the change", () => {
    notifyCalendarWriteError(
      new ApiException({
        code: ApiErrorCode.CONFLICT,
        message:
          "This event changed in Google since it was opened. Open it again and redo the change.",
        status: 409,
      }),
    );

    expect(mockToast).toHaveBeenCalledWith({
      title: "Not saved to Google Calendar",
      description:
        "This event changed in Google since it was opened. Open it again and redo the change.",
      variant: "destructive",
    });
  });
});
