import { QueryClient } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { type FamilyApiResponse, familyKeys } from "@/api";
import type {
  FamilyData,
  ThemePackDocument,
  UpdateFamilyRequest,
} from "@/lib/types";
import { useHapticsPreference } from "@/stores";
import { THEME_STORAGE_KEY, useThemeStore } from "@/stores/theme-store";
import {
  API_BASE,
  resetMockFamily,
  resetMockThemePacks,
  seedMockFamily,
  seedMockThemePacks,
} from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import {
  render,
  renderWithUser,
  screen,
  waitFor,
  within,
} from "@/test/test-utils";
import { PreferencesSheet } from "./preferences-sheet";

// ============================================================================
// Test Setup
// ============================================================================

function baseFamily(timezone?: string): FamilyData {
  return {
    id: "family-1",
    name: "Test Family",
    timezone,
    members: [{ id: "member-1", name: "Alice", color: "coral" }],
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

/**
 * Dedicated client with `gcTime`/`staleTime` of Infinity so the optimistic
 * cache survives the test and no background refetch races our assertions.
 */
function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function seedClient(family: FamilyData): QueryClient {
  seedMockFamily(family);
  const client = createClient();
  client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
    data: family,
  });
  return client;
}

function getTimezoneSelect(): HTMLSelectElement {
  return screen.getByLabelText(/family timezone/i);
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  resetMockFamily();
});

afterEach(() => {
  server.resetHandlers();
});

const noop = () => {};

// ============================================================================
// Timezone control
// ============================================================================

describe("PreferencesSheet — timezone", () => {
  it("shows the timezone from the family API, not a hardcoded default", () => {
    const client = seedClient(baseFamily("America/Chicago"));

    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });

    expect(getTimezoneSelect().value).toBe("America/Chicago");
  });

  it("selects nothing while the timezone is not yet known", () => {
    // Pre-1.6.0 localStorage cache: family exists but carries no timezone.
    const client = seedClient(baseFamily(undefined));

    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });

    expect(getTimezoneSelect().value).toBe("");
  });

  it("offers the current non-curated zone as a selectable option", () => {
    const client = seedClient(baseFamily("Asia/Manila"));

    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });

    const select = getTimezoneSelect();
    expect(select.value).toBe("Asia/Manila");
    expect(
      screen.getByRole("option", { name: /asia\/manila/i }),
    ).toBeInTheDocument();
  });

  it("saves a curated zone through PUT /family and updates optimistically", async () => {
    const putBodies: UpdateFamilyRequest[] = [];
    server.use(
      http.put(`${API_BASE}/family`, async ({ request }) => {
        const body = (await request.json()) as UpdateFamilyRequest;
        putBodies.push(body);
        return HttpResponse.json({
          data: { ...baseFamily("America/Chicago"), ...body },
          message: "Family updated successfully",
        });
      }),
    );

    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      {
        queryClient: client,
      },
    );

    await user.selectOptions(getTimezoneSelect(), "America/New_York");

    await waitFor(() => {
      expect(putBodies).toEqual([{ timezone: "America/New_York" }]);
    });
    expect(getTimezoneSelect().value).toBe("America/New_York");
  });

  it("uses the device timezone via Intl when the detect action is pressed", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Pacific/Honolulu",
    } as Intl.ResolvedDateTimeFormatOptions);

    const putBodies: UpdateFamilyRequest[] = [];
    server.use(
      http.put(`${API_BASE}/family`, async ({ request }) => {
        const body = (await request.json()) as UpdateFamilyRequest;
        putBodies.push(body);
        return HttpResponse.json({
          data: { ...baseFamily("America/Chicago"), ...body },
          message: "Family updated successfully",
        });
      }),
    );

    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      {
        queryClient: client,
      },
    );

    await user.click(
      screen.getByRole("button", { name: /use this device's timezone/i }),
    );

    await waitFor(() => {
      expect(putBodies).toEqual([{ timezone: "Pacific/Honolulu" }]);
    });
    expect(getTimezoneSelect().value).toBe("Pacific/Honolulu");
  });

  it("surfaces a BE validation error inline and rolls back non-destructively", async () => {
    server.use(
      http.put(`${API_BASE}/family`, () =>
        HttpResponse.json(
          { message: "Timezone must be a valid IANA timezone." },
          { status: 400 },
        ),
      ),
    );

    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      {
        queryClient: client,
      },
    );

    await user.selectOptions(getTimezoneSelect(), "America/Denver");

    expect(
      await screen.findByText("Timezone must be a valid IANA timezone."),
    ).toBeInTheDocument();
    // Rolled back to the server-known value; the control stays usable.
    expect(getTimezoneSelect().value).toBe("America/Chicago");
    expect(getTimezoneSelect()).toBeEnabled();
  });
});

// ============================================================================
// Coming-soon stubs
// ============================================================================

describe("PreferencesSheet — roadmap stubs", () => {
  it("renders exactly one disabled Coming soon row: Notifications", () => {
    const client = seedClient(baseFamily("America/Chicago"));

    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });

    const stubRows = screen.getAllByRole("button", { name: /coming soon/i });
    expect(stubRows).toHaveLength(1);
    const notifications = screen.getByRole("button", {
      name: /notifications/i,
    });
    expect(notifications).toBeDisabled();
    expect(notifications).toHaveAttribute("aria-disabled", "true");
  });
});

// ============================================================================
// Appearance (per-device look)
// ============================================================================

describe("PreferencesSheet — appearance", () => {
  beforeEach(() => {
    useThemeStore.setState({
      mode: "single",
      selection: { kind: "builtin", id: "default" },
      daySelection: { kind: "builtin", id: "default" },
      nightSelection: { kind: "builtin", id: "midnight" },
      daytime: true,
      appliedPacks: {},
    });
  });

  it("offers the three built-in looks as a radio group with Default selected", () => {
    const client = seedClient(baseFamily("America/Chicago"));
    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });

    const group = screen.getByRole("radiogroup", { name: /look/i });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Default",
      "Midnight",
      "Sunrise",
    ]);
    expect(within(group).getByRole("radio", { name: "Default" })).toBeChecked();
    expect(
      within(group).getByRole("radio", { name: "Midnight" }),
    ).not.toBeChecked();
    // The user is told the choice is per device, not per family.
    expect(
      screen.getByText(/applies to this device only/i),
    ).toBeInTheDocument();
  });

  it("a sun switch reveals a daytime look and a night-time look", async () => {
    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    const sunSwitch = screen.getByRole("switch", {
      name: /change with the sun/i,
    });
    expect(sunSwitch).toHaveAttribute("aria-checked", "false");
    expect(
      screen.queryByRole("radiogroup", { name: /daytime look/i }),
    ).not.toBeInTheDocument();

    await user.click(sunSwitch);
    expect(useThemeStore.getState().mode).toBe("sun");
    const day = screen.getByRole("radiogroup", { name: /daytime look/i });
    const night = screen.getByRole("radiogroup", { name: /night-time look/i });
    expect(within(day).getByRole("radio", { name: "Default" })).toBeChecked();
    expect(
      within(night).getByRole("radio", { name: "Midnight" }),
    ).toBeChecked();
    // The single-look group steps aside while the sun is in charge.
    expect(
      screen.queryByRole("radiogroup", { name: "Look" }),
    ).not.toBeInTheDocument();

    await user.click(within(night).getByRole("radio", { name: "Sunrise" }));
    expect(useThemeStore.getState().nightSelection).toEqual({
      kind: "builtin",
      id: "sunrise",
    });
    expect(useThemeStore.getState().daySelection).toEqual({
      kind: "builtin",
      id: "default",
    });
  });

  it("says where today's sunrise and sunset come from", () => {
    useThemeStore.setState({ mode: "sun" });
    const located = seedClient({
      ...baseFamily("America/Los_Angeles"),
      weatherLocation: "San Diego, California",
      latitude: 32.7157,
      longitude: -117.1647,
    });
    const { unmount } = render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: located,
    });
    expect(screen.getByText(/^Today:/)).toHaveTextContent(/weather location/i);
    unmount();

    const unlocated = seedClient(baseFamily("America/Chicago"));
    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: unlocated,
    });
    expect(screen.getByText(/^Today:/)).toHaveTextContent(/estimated/i);
  });

  it("choosing Midnight stores the selection on this device", async () => {
    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    await user.click(screen.getByRole("radio", { name: "Midnight" }));

    expect(useThemeStore.getState().selection).toEqual({
      kind: "builtin",
      id: "midnight",
    });
    expect(screen.getByRole("radio", { name: "Midnight" })).toBeChecked();
    // Nothing goes to the server: the look is a device preference.
    expect(
      JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? "{}").state
        .selection,
    ).toEqual({ kind: "builtin", id: "midnight" });
  });
});

// ============================================================================
// Haptics helpers
// ============================================================================

function setVibrate(on: boolean) {
  // A capable device is touch-primary (coarse pointer) AND exposes the
  // Vibration API — canVibrate() now requires both, so a mouse-primary desktop
  // (fine pointer, no-op vibrate) hides the section.
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query.includes("coarse") ? on : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  if (on) {
    Object.defineProperty(navigator, "vibrate", {
      value: () => true,
      configurable: true,
      writable: true,
    });
  } else {
    delete (navigator as { vibrate?: unknown }).vibrate;
  }
}

// ============================================================================
// Breakpoints (mirrors responsive-form-dialog-breakpoint.test.tsx)
// ============================================================================

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });

  vi.mocked(window.matchMedia).mockImplementation((query: string) => {
    const maxWidth = Number.parseInt(
      query.match(/max-width:\s*(\d+)px/)?.[1] ?? "",
      10,
    );
    const minWidth = Number.parseInt(
      query.match(/min-width:\s*(\d+)px/)?.[1] ?? "",
      10,
    );

    const matchesMax = Number.isNaN(maxWidth) || width <= maxWidth;
    const matchesMin = Number.isNaN(minWidth) || width >= minWidth;

    return {
      matches: matchesMax && matchesMin,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

describe("PreferencesSheet — breakpoints", () => {
  it("renders the full-height mobile sheet below the 768px md breakpoint", () => {
    setViewportWidth(767);
    const client = seedClient(baseFamily("America/Chicago"));

    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });

    expect(
      screen.getByRole("dialog", { name: "Preferences" }),
    ).toBeInTheDocument();
    // The mobile sheet supplies the Cancel chrome.
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders the centered dialog above the 768px app mobile breakpoint", () => {
    setViewportWidth(769);
    const client = seedClient(baseFamily("America/Chicago"));

    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });

    expect(
      screen.getByRole("dialog", { name: "Preferences" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});

// ============================================================================
// Haptics section
// ============================================================================

describe("PreferencesSheet — Haptics section", () => {
  afterEach(() => setVibrate(false));

  it("is absent when navigator.vibrate is unsupported", () => {
    setVibrate(false);
    const client = seedClient(baseFamily("America/Chicago"));
    render(<PreferencesSheet open onOpenChange={noop} />, {
      queryClient: client,
    });
    expect(screen.queryByRole("heading", { name: /haptics/i })).toBeNull();
  });

  it("shows the master switch and reveals sub-switches when enabled", async () => {
    setVibrate(true);
    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );
    expect(
      screen.getByRole("heading", { name: /haptics/i }),
    ).toBeInTheDocument();
    // sub-switches hidden while master is off
    expect(screen.queryByRole("switch", { name: /taps/i })).toBeNull();

    await user.click(screen.getByRole("switch", { name: /enable haptics/i }));
    expect(useHapticsPreference.getState().enabled).toBe(true);

    // sub-switches now visible; toggling one writes its category
    await user.click(screen.getByRole("switch", { name: /taps/i }));
    expect(useHapticsPreference.getState().categories.taps).toBe(false);
  });
});

// ============================================================================
// Weather location
// ============================================================================

describe("PreferencesSheet — weather location", () => {
  it("shows the saved place and saves a new one through PUT /family", async () => {
    const putBodies: UpdateFamilyRequest[] = [];
    server.use(
      http.put(`${API_BASE}/family`, async ({ request }) => {
        const body = (await request.json()) as UpdateFamilyRequest;
        putBodies.push(body);
        return HttpResponse.json({
          data: {
            ...baseFamily("America/Los_Angeles"),
            weatherLocation: "San Diego, California",
          },
        });
      }),
    );
    const client = seedClient({
      ...baseFamily("America/Los_Angeles"),
      weatherLocation: "Tustin, California",
    });

    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    const input = screen.getByLabelText(/weather location/i);
    expect(input).toHaveValue("Tustin, California");

    await user.clear(input);
    await user.type(input, "San Diego");
    await user.click(screen.getByRole("button", { name: /save location/i }));

    await waitFor(() => {
      expect(putBodies).toEqual([{ weatherLocation: "San Diego" }]);
    });
    await waitFor(() => {
      expect(input).toHaveValue("San Diego, California");
    });
  });

  it("surfaces the API's message when a place cannot be found", async () => {
    server.use(
      http.put(`${API_BASE}/family`, () =>
        HttpResponse.json(
          {
            message:
              "Could not find that location. Try a city and state, or a postal code.",
          },
          { status: 400 },
        ),
      ),
    );
    const client = seedClient(baseFamily("America/Los_Angeles"));

    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    await user.type(screen.getByLabelText(/weather location/i), "nowhere");
    await user.click(screen.getByRole("button", { name: /save location/i }));

    expect(
      await screen.findByText(/could not find that location/i),
    ).toBeInTheDocument();
  });
});

// ============================================================================
// Appearance — theme packs (family data, chosen per device)
// ============================================================================

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PADRES_PACK: ThemePackDocument = {
  version: 1,
  name: "Padres",
  dark: true,
  tokens: {
    "--background": "#2f241d",
    "--card": "#3a2d24",
    "--primary": "#ffc425",
  },
  images: { logo: PNG_PIXEL },
  slots: { headerLogo: "logo" },
};

describe("PreferencesSheet — theme packs", () => {
  beforeEach(() => {
    resetMockThemePacks();
    useThemeStore.setState({
      mode: "single",
      selection: { kind: "builtin", id: "default" },
      daySelection: { kind: "builtin", id: "default" },
      nightSelection: { kind: "builtin", id: "midnight" },
      daytime: true,
      appliedPacks: {},
    });
  });

  it("lists imported packs beside the built-in looks and applies one when chosen", async () => {
    seedMockThemePacks([PADRES_PACK]);
    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    const padres = await screen.findByRole("radio", { name: "Padres" });
    expect(padres).not.toBeChecked();
    await user.click(padres);

    await waitFor(() => {
      expect(useThemeStore.getState().resolved).toEqual({
        theme: "pack",
        dark: true,
      });
    });
    expect(
      Object.values(useThemeStore.getState().appliedPacks).map((p) => p.name),
    ).toEqual(["Padres"]);
    expect(screen.getByRole("radio", { name: "Padres" })).toBeChecked();
  });

  it("imports a pack from a file and shows it", async () => {
    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    const file = new File(
      [JSON.stringify(PADRES_PACK)],
      "padres.familytheme.json",
      {
        type: "application/json",
      },
    );
    await user.upload(screen.getByLabelText("Import theme pack"), file);

    expect(
      await screen.findByRole("radio", { name: "Padres" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(/Padres/);
  });

  it("explains a rejected file instead of failing silently", async () => {
    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    const file = new File(["{not json"], "broken.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText("Import theme pack"), file);

    expect(
      await screen.findByText(/not a theme pack file/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Padres" }),
    ).not.toBeInTheDocument();
  });

  it("exports a pack as a download and deletes one after confirmation", async () => {
    seedMockThemePacks([PADRES_PACK]);
    const client = seedClient(baseFamily("America/Chicago"));
    const createObjectURL = vi.fn(() => "blob:pack");
    const revokeObjectURL = vi.fn();
    const urlDescriptors = {
      create: Object.getOwnPropertyDescriptor(URL, "createObjectURL"),
      revoke: Object.getOwnPropertyDescriptor(URL, "revokeObjectURL"),
    };
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });
    const clicks: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.download);
    };
    try {
      const { user } = renderWithUser(
        <PreferencesSheet open onOpenChange={noop} />,
        { queryClient: client },
      );
      await screen.findByRole("radio", { name: "Padres" });

      await user.click(screen.getByRole("button", { name: "Export Padres" }));
      await waitFor(() => expect(clicks).toEqual(["padres.familytheme.json"]));
      expect(createObjectURL).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: "Delete Padres" }));
      // A second, explicit confirmation before anything is removed.
      await user.click(screen.getByRole("button", { name: /confirm delete/i }));
      await waitFor(() => {
        expect(
          screen.queryByRole("radio", { name: "Padres" }),
        ).not.toBeInTheDocument();
      });
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      for (const [key, descriptor] of [
        ["createObjectURL", urlDescriptors.create],
        ["revokeObjectURL", urlDescriptors.revoke],
      ] as const) {
        if (descriptor) Object.defineProperty(URL, key, descriptor);
        else Reflect.deleteProperty(URL, key);
      }
    }
  });
});

describe("PreferencesSheet — unsaved changes", () => {
  it("warns before closing with an unsaved weather location", async () => {
    const client = seedClient(baseFamily("America/Chicago"));
    const onOpenChange = vi.fn();
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={onOpenChange} />,
      { queryClient: client },
    );

    await user.type(screen.getByLabelText("Weather location"), "San Diego");
    await user.click(screen.getAllByRole("button", { name: "Close" })[0]);

    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("PreferencesSheet — screensaver", () => {
  it("chooses when this device starts the screensaver, and can show it now", async () => {
    const { useScreensaverStore } = await import("@/stores");
    const client = seedClient(baseFamily("America/Chicago"));
    const { user } = renderWithUser(
      <PreferencesSheet open onOpenChange={noop} />,
      { queryClient: client },
    );

    const select = screen.getByLabelText("Start the screensaver after");
    expect(select).toHaveValue("auto");
    await user.selectOptions(select, "5");
    expect(useScreensaverStore.getState().delay).toBe(5);

    await user.click(screen.getByRole("button", { name: "Show it now" }));
    expect(useScreensaverStore.getState().isActive).toBe(true);
  });
});
