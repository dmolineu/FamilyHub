import { Toaster } from "@/components/ui/toaster";
import {
  act,
  fireEvent,
  render,
  renderWithUser,
  screen,
} from "@/test/test-utils";

const { updateServiceWorker, captured } = vi.hoisted(() => ({
  updateServiceWorker: vi.fn(),
  captured: {} as {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, r?: ServiceWorkerRegistration) => void;
  },
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (opts: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, r?: ServiceWorkerRegistration) => void;
  }) => {
    captured.onNeedRefresh = opts.onNeedRefresh;
    captured.onOfflineReady = opts.onOfflineReady;
    captured.onRegisteredSW = opts.onRegisteredSW;
    return { updateServiceWorker };
  },
}));

import { useDisplayStore } from "@/stores/display-store";
import {
  PWAUpdater,
  UPDATE_CHECK_INTERVAL_MS,
  WALL_UPDATE_IDLE_MS,
} from "./pwa-updater";

describe("PWAUpdater", () => {
  it("shows an update toast with a Reload action that updates the SW", async () => {
    const { user } = renderWithUser(
      <>
        <PWAUpdater />
        <Toaster />
      </>,
    );

    // Simulate vite-plugin-pwa signaling a waiting service worker.
    act(() => {
      captured.onNeedRefresh?.();
    });

    expect(screen.getByText("Update available")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reload/i }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  describe("on a screen left running", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      updateServiceWorker.mockClear();
    });

    afterEach(() => {
      vi.useRealTimers();
      useDisplayStore.setState({ mode: "standard" });
    });

    it("asks the server for a new version every hour", () => {
      render(<PWAUpdater />);
      const registration = { update: vi.fn(() => Promise.resolve()) };
      act(() => {
        captured.onRegisteredSW?.(
          "/sw.js",
          registration as unknown as ServiceWorkerRegistration,
        );
      });

      act(() => {
        vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
      });
      expect(registration.update).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
      });
      expect(registration.update).toHaveBeenCalledTimes(2);
    });

    it("updates a wall by itself once nobody has touched it for a while", () => {
      useDisplayStore.setState({ mode: "wall" });
      render(<PWAUpdater />);
      act(() => {
        captured.onNeedRefresh?.();
      });

      act(() => {
        vi.advanceTimersByTime(WALL_UPDATE_IDLE_MS - 1_000);
      });
      // A tap starts the wait again, so the page never reloads under a hand.
      fireEvent.pointerDown(window);
      act(() => {
        vi.advanceTimersByTime(WALL_UPDATE_IDLE_MS - 1_000);
      });
      expect(updateServiceWorker).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(updateServiceWorker).toHaveBeenCalledWith(true);
    });

    it("waits while a dialog is open on the wall", () => {
      useDisplayStore.setState({ mode: "wall" });
      render(
        <>
          <PWAUpdater />
          <div role="dialog" aria-label="Edit event" />
        </>,
      );
      act(() => {
        captured.onNeedRefresh?.();
      });

      act(() => {
        vi.advanceTimersByTime(WALL_UPDATE_IDLE_MS * 3);
      });
      expect(updateServiceWorker).not.toHaveBeenCalled();
    });

    it("still updates a wall that is showing the screensaver", () => {
      useDisplayStore.setState({ mode: "wall" });
      render(
        <>
          <PWAUpdater />
          <div role="dialog" aria-label="Screensaver" data-screensaver="" />
        </>,
      );
      act(() => {
        captured.onNeedRefresh?.();
      });

      act(() => {
        vi.advanceTimersByTime(WALL_UPDATE_IDLE_MS);
      });
      expect(updateServiceWorker).toHaveBeenCalledWith(true);
    });

    it("leaves phones and laptops to the Reload button", () => {
      render(<PWAUpdater />);
      act(() => {
        captured.onNeedRefresh?.();
      });

      act(() => {
        vi.advanceTimersByTime(WALL_UPDATE_IDLE_MS * 3);
      });
      expect(updateServiceWorker).not.toHaveBeenCalled();
    });
  });
});
