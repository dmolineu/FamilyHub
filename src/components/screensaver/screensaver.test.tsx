import { act, fireEvent, within } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { FamilyMember, Photo, WeatherData } from "@/lib/types";
import {
  seedMockPhotos,
  seedMockWeather,
  setupMswServer,
} from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
} from "@/test/test-utils";
import { Screensaver } from "./screensaver";

setupMswServer();

// jsdom has no PointerEvent; a MouseEvent with a pointerId is all the swipe needs.
beforeAll(() => {
  if (!("PointerEvent" in window)) {
    class PointerEventShim extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.defineProperty(window, "PointerEvent", { value: PointerEventShim });
  }
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:photo-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

const MEMBERS: FamilyMember[] = [
  { id: "mom", name: "Mom", color: "coral" },
  {
    id: "leo",
    name: "Leo",
    color: "orange",
    birthday: { month: 6, day: 1, year: 2019 },
  },
  { id: "dad", name: "Dad", color: "green", birthday: { month: 11, day: 3 } },
  {
    id: "maya",
    name: "Maya",
    color: "teal",
    birthday: { month: 10, day: 28, year: 2016 },
  },
];

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

const WEATHER: WeatherData = {
  location: "San Diego, California",
  updatedAt: "2026-10-25T19:30:00Z",
  current: {
    temperature: 68,
    weatherCode: 2,
    description: "Partly cloudy",
    isDay: true,
  },
  daily: [],
};

function currentPhotoId(): string | null {
  return (
    screen.queryByTestId("screensaver-photo")?.getAttribute("data-photo-id") ??
    null
  );
}

describe("Screensaver", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 12:42 PM on Sunday, October 25 in Los Angeles.
    vi.setSystemTime(new Date("2026-10-25T19:42:00Z"));
    seedFamilyStore({ members: MEMBERS, timezone: "America/Los_Angeles" });
    seedMockWeather(WEATHER);
    seedMockPhotos([photo("p1"), photo("p2"), photo("p3")]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the time, the day and date, and the weather", async () => {
    renderWithUser(<Screensaver onDismiss={vi.fn()} shuffle={false} />);

    expect(await screen.findByText("Sunday, October 25")).toBeInTheDocument();
    expect(screen.getByTestId("screensaver-time").textContent).toMatch(
      /^12:42\sPM$/,
    );
    expect(await screen.findByText("68°")).toBeInTheDocument();
    expect(screen.getByText("Partly cloudy")).toBeInTheDocument();
  });

  it("counts down to everyone's birthday, soonest first", async () => {
    renderWithUser(<Screensaver onDismiss={vi.fn()} shuffle={false} />);

    const birthdays = await screen.findByRole("region", { name: "Birthdays" });
    const rows = within(birthdays).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Maya.*In 3 days.*turns 10/),
      expect.stringMatching(/Dad.*In 9 days/),
      expect.stringMatching(/Leo.*In 219 days.*turns 8/),
    ]);
    // Mom has no birthday set, so she is not listed.
    expect(birthdays).not.toHaveTextContent("Mom");
  });

  it("moves to the next photo every 10 seconds", async () => {
    renderWithUser(<Screensaver onDismiss={vi.fn()} shuffle={false} />);
    await waitFor(() => expect(currentPhotoId()).toBe("p1"));

    act(() => vi.advanceTimersByTime(10_000));
    await waitFor(() => expect(currentPhotoId()).toBe("p2"));
    act(() => vi.advanceTimersByTime(10_000));
    await waitFor(() => expect(currentPhotoId()).toBe("p3"));
    act(() => vi.advanceTimersByTime(10_000));
    await waitFor(() => expect(currentPhotoId()).toBe("p1"));
  });

  it("swipes left for the next photo and right for the previous without closing", async () => {
    const onDismiss = vi.fn();
    renderWithUser(<Screensaver onDismiss={onDismiss} shuffle={false} />);
    await waitFor(() => expect(currentPhotoId()).toBe("p1"));
    const surface = screen.getByTestId("screensaver");

    const swipe = (fromX: number, toX: number) => {
      fireEvent.pointerDown(surface, { clientX: fromX, clientY: 300 });
      fireEvent.pointerUp(surface, { clientX: toX, clientY: 310 });
      fireEvent.click(surface, { clientX: toX, clientY: 310 });
    };

    swipe(600, 200);
    await waitFor(() => expect(currentPhotoId()).toBe("p2"));
    swipe(200, 600);
    await waitFor(() => expect(currentPhotoId()).toBe("p1"));
    swipe(200, 600);
    await waitFor(() => expect(currentPhotoId()).toBe("p3"));
    expect(onDismiss).not.toHaveBeenCalled();

    // A swipe restarts the 10 seconds, so the photo just chosen stays a while.
    act(() => vi.advanceTimersByTime(9_000));
    expect(currentPhotoId()).toBe("p3");
  });

  it("closes on a tap", async () => {
    const onDismiss = vi.fn();
    const { user } = renderWithUser(
      <Screensaver onDismiss={onDismiss} shuffle={false} />,
    );

    await user.click(screen.getByTestId("screensaver"));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("uses the arrow keys to move between photos and any other key to close", async () => {
    const onDismiss = vi.fn();
    const { user } = renderWithUser(
      <Screensaver onDismiss={onDismiss} shuffle={false} />,
    );
    await waitFor(() => expect(currentPhotoId()).toBe("p1"));

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(currentPhotoId()).toBe("p2"));
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(currentPhotoId()).toBe("p1"));
    expect(onDismiss).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("still shows the clock, weather and birthdays with no photos", async () => {
    seedMockPhotos([]);
    renderWithUser(<Screensaver onDismiss={vi.fn()} shuffle={false} />);

    expect(await screen.findByText("Sunday, October 25")).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "Birthdays" }),
    ).toBeInTheDocument();
    expect(currentPhotoId()).toBeNull();
  });
});
