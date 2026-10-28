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
import { useScreensaverStore } from "@/stores";
import {
  seedMockPhotoSource,
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

  it("shows the pictures from the family's photo folder too", async () => {
    seedMockPhotos([photo("p1")]);
    seedMockPhotoSource({ folder: "/photos/nas", photoCount: 1 }, ["f1"]);
    renderWithUser(<Screensaver onDismiss={vi.fn()} shuffle={false} />);
    await waitFor(() => expect(currentPhotoId()).toBe("p1"));

    act(() => vi.advanceTimersByTime(10_000));

    await waitFor(() => expect(currentPhotoId()).toBe("folder:f1"));
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

  it("marks itself so a wall's waiting update can install underneath it", () => {
    renderWithUser(<Screensaver onDismiss={vi.fn()} shuffle={false} />);

    expect(screen.getByTestId("screensaver")).toHaveAttribute(
      "data-screensaver",
    );
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

  it("is a dark screen during this device's night hours, and a tap still closes it", async () => {
    // 12:42 PM is inside a night set to run from noon to 1 PM.
    useScreensaverStore.setState({
      night: { enabled: true, from: "12:00", to: "13:00" },
    });
    const onDismiss = vi.fn();
    const { user } = renderWithUser(
      <Screensaver onDismiss={onDismiss} shuffle={false} />,
    );

    const screensaver = screen.getByTestId("screensaver");
    expect(screensaver).toHaveAttribute("data-night", "true");
    expect(screen.queryByTestId("screensaver-time")).not.toBeInTheDocument();
    expect(screen.queryByTestId("screensaver-photo")).not.toBeInTheDocument();

    await user.click(screensaver);
    expect(onDismiss).toHaveBeenCalled();
    useScreensaverStore.setState({
      night: { enabled: false, from: "22:00", to: "06:30" },
    });
  });

  it("shows photos outside the night hours", async () => {
    useScreensaverStore.setState({
      night: { enabled: true, from: "22:00", to: "06:30" },
    });
    renderWithUser(<Screensaver onDismiss={vi.fn()} shuffle={false} />);
    expect(screen.getByTestId("screensaver")).toHaveAttribute(
      "data-night",
      "false",
    );
    expect(await screen.findByTestId("screensaver-time")).toBeInTheDocument();
    useScreensaverStore.setState({
      night: { enabled: false, from: "22:00", to: "06:30" },
    });
  });

  it("moves the time, weather and birthdays to another corner every 10 minutes", async () => {
    // The start of a 10-minute slot on the clock.
    vi.setSystemTime(new Date("2026-10-25T19:40:00Z"));
    renderWithUser(<Screensaver onDismiss={() => {}} shuffle={false} />);
    const info = await screen.findByTestId("screensaver-info");
    expect(within(info).getByTestId("screensaver-time")).toBeInTheDocument();
    expect(within(info).getByLabelText("Birthdays")).toBeInTheDocument();
    const corner = () =>
      screen.getByTestId("screensaver-info").getAttribute("data-corner") ?? "";
    const first = corner();

    // Still there after nine minutes.
    act(() => vi.advanceTimersByTime(9 * 60_000));
    expect(corner()).toBe(first);

    // Then a move every 10 minutes, always between top and bottom (the big
    // clock never stays on the same rows), and through all four corners.
    const seen = [first];
    act(() => vi.advanceTimersByTime(60_000));
    for (let move = 0; move < 4; move++) {
      const [fromSide] = seen[seen.length - 1].split("-");
      const [toSide] = corner().split("-");
      expect(toSide).not.toBe(fromSide);
      seen.push(corner());
      act(() => vi.advanceTimersByTime(10 * 60_000));
    }
    expect(new Set(seen.slice(0, 4)).size).toBe(4);
    expect(seen[4]).toBe(first);
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
