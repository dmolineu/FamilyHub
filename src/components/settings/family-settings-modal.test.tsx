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
  AddMemberRequest,
  BackupDocument,
  FamilyData,
  UpdateMemberRequest,
} from "@/lib/types";
import { testBackupDocument } from "@/test/fixtures/backup";
import {
  API_BASE,
  resetMockFamily,
  seedMockBackupDocument,
  seedMockFamily,
} from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import {
  createTestQueryClient,
  render,
  renderWithUser,
  screen,
  waitFor,
  within,
} from "@/test/test-utils";
import { FamilySettingsModal } from "./family-settings-modal";

// The responsive wrapper switches on useIsMobile; default to desktop so the
// existing dialog-role assertions below keep exercising the centered dialog.
let mockIsMobile = false;
vi.mock("@/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks")>();
  return { ...actual, useIsMobile: () => mockIsMobile };
});

// ============================================================================
// Test Setup
// ============================================================================

const alice = { id: "member-1", name: "Alice", color: "coral" } as const;

function baseFamily(): FamilyData {
  return {
    id: "family-1",
    name: "Test Family",
    members: [{ ...alice }],
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

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  resetMockFamily();
  mockIsMobile = false;
});

afterEach(() => {
  server.resetHandlers();
});

const noop = () => {};

// ============================================================================
// Pending member guard
// ============================================================================

describe("FamilySettingsModal — pending member controls", () => {
  it("disables edit/remove for a member whose add has not been confirmed", () => {
    // A member still carrying the optimistic `temp-` id from useAddMember:
    // its create round-trip has not resolved, so the server does not know it yet.
    const family: FamilyData = {
      ...baseFamily(),
      members: [
        { ...alice },
        { id: "temp-1700000000000", name: "Bob", color: "teal" },
      ],
    };
    const client = createClient();
    client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
      data: family,
    });

    render(<FamilySettingsModal open onOpenChange={noop} />, {
      queryClient: client,
    });

    // Confirmed member: controls are interactive.
    expect(screen.getByRole("button", { name: "Edit Alice" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove Alice" })).toBeEnabled();

    // Unconfirmed member: editing/removing it would target a non-existent
    // `temp-` id on the server, so the controls must be disabled until the
    // add is confirmed.
    expect(screen.getByRole("button", { name: "Edit Bob" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Bob" })).toBeDisabled();
  });

  it("uses plain language instead of 'Danger Zone'", () => {
    const client = createClient();
    client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
      data: baseFamily(),
    });

    render(<FamilySettingsModal open onOpenChange={noop} />, {
      queryClient: client,
    });

    expect(screen.queryByText(/danger zone/i)).toBeNull();
    expect(screen.getByText(/reset this family/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Add → edit race (the e2e flake reproduced deterministically)
// ============================================================================

describe("FamilySettingsModal — add then immediately edit", () => {
  it("never sends the rename to a temp id and keeps the rename after the add confirms", async () => {
    // Gate the add POST so the optimistic `temp-` id is still in the list when
    // we open the editor — this is the exact window the parallel e2e workers hit.
    let releasePost!: () => void;
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    const putIds: string[] = [];

    server.use(
      http.post(`${API_BASE}/family/members`, async ({ request }) => {
        const body = (await request.json()) as AddMemberRequest;
        await postGate;
        return HttpResponse.json({
          data: { id: "member-real", name: body.name, color: body.color },
          message: "Member added",
        });
      }),
      http.put(
        `${API_BASE}/family/members/:id`,
        async ({ params, request }) => {
          putIds.push(String(params.id));
          const body = (await request.json()) as UpdateMemberRequest;
          return HttpResponse.json({
            data: { id: String(params.id), name: body.name, color: body.color },
            message: "Member updated",
          });
        },
      ),
    );

    const family = baseFamily();
    seedMockFamily(family);
    const client = createClient();
    client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
      data: family,
    });

    const { user } = renderWithUser(
      <FamilySettingsModal open onOpenChange={noop} />,
      { queryClient: client },
    );

    // --- Add "Bob" (POST is gated, so Bob stays optimistic) ---
    await user.click(screen.getByRole("button", { name: "Add" }));
    const addDialog = await screen.findByRole("dialog", {
      name: "Add Family Member",
    });
    await user.type(
      within(addDialog).getByPlaceholderText("Enter name"),
      "Bob",
    );
    await user.click(
      within(addDialog).getByRole("button", { name: /select teal color/i }),
    );
    await user.click(within(addDialog).getByRole("button", { name: "Add" }));

    // Optimistic Bob is shown but unconfirmed → its edit control is disabled.
    const editBob = await screen.findByRole("button", { name: "Edit Bob" });
    expect(editBob).toBeDisabled();

    // --- Confirm the add; the real id replaces the temp id ---
    releasePost();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Bob" })).toBeEnabled(),
    );

    // --- Rename Bob → Robert ---
    await user.click(screen.getByRole("button", { name: "Edit Bob" }));
    const editDialog = await screen.findByRole("dialog", {
      name: "Edit Family Member",
    });
    const nameInput = within(editDialog).getByPlaceholderText("Enter name");
    await user.clear(nameInput);
    await user.type(nameInput, "Robert");
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));

    // The rename sticks (it was sent to the real id, not a temp id).
    expect(
      await screen.findByRole("button", { name: "Edit Robert" }),
    ).toBeInTheDocument();
    expect(putIds.length).toBeGreaterThan(0);
    expect(putIds.some((id) => id.startsWith("temp-"))).toBe(false);
  });
});

describe("FamilySettingsModal — renaming keeps the rest of the profile", () => {
  it("sends the member's email, photo and birthday along with a rename", async () => {
    const maya = {
      id: "member-9",
      name: "Maya",
      color: "teal" as const,
      email: "maya@example.com",
      avatarUrl: "https://example.com/maya.png",
      birthday: { month: 10, day: 28, year: 2016 },
    };
    const family = { ...baseFamily(), members: [maya] };
    seedMockFamily(family);
    const client = createClient();
    client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
      data: family,
    });
    let body: Record<string, unknown> | null = null;
    server.use(
      http.put(`${API_BASE}/family/members/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: { ...maya, ...body },
          message: "Member updated",
        });
      }),
    );
    const { user } = renderWithUser(
      <FamilySettingsModal open onOpenChange={noop} />,
      { queryClient: client },
    );

    await user.click(await screen.findByRole("button", { name: "Edit Maya" }));
    const editDialog = await screen.findByRole("dialog", {
      name: "Edit Family Member",
    });
    const nameInput = within(editDialog).getByPlaceholderText("Enter name");
    await user.clear(nameInput);
    await user.type(nameInput, "Maya B");
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      name: "Maya B",
      color: "teal",
      email: "maya@example.com",
      avatarUrl: "https://example.com/maya.png",
      birthday: { month: 10, day: 28, year: 2016 },
    });
  });
});

// ============================================================================
// Responsive surface: centered dialog on desktop, bottom sheet on mobile
// ============================================================================

describe("FamilySettingsModal — responsive surface", () => {
  function seededClient(): QueryClient {
    const client = createClient();
    client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
      data: baseFamily(),
    });
    return client;
  }

  it("renders a centered dialog with an X close button on desktop", () => {
    mockIsMobile = false;
    render(<FamilySettingsModal open onOpenChange={noop} />, {
      queryClient: seededClient(),
    });

    expect(
      screen.getByRole("dialog", { name: "Family Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    // The mobile sheet's Cancel chrome is absent on desktop.
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("renders the content in a bottom sheet with Cancel (no X) on mobile", () => {
    mockIsMobile = true;
    render(<FamilySettingsModal open onOpenChange={noop} />, {
      queryClient: seededClient(),
    });

    expect(
      screen.getByRole("dialog", { name: "Family Settings" }),
    ).toBeInTheDocument();
    // Sheet supplies the Cancel affordance; the in-content X close is desktop-only.
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    // Content still renders inside the sheet.
    expect(
      screen.getByRole("button", { name: "Edit Alice" }),
    ).toBeInTheDocument();
  });
});

// ============================================================================
// Backup and restore
// ============================================================================

// jsdom's Blob has no text(); read it the way a browser would.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

describe("FamilySettingsModal — backup and restore", () => {
  function seededClient(): QueryClient {
    seedMockFamily(baseFamily());
    const client = createTestQueryClient();
    client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
      data: baseFamily(),
    });
    return client;
  }

  it("downloads the backup as a JSON file", async () => {
    seedMockBackupDocument(testBackupDocument);
    const createObjectURL = vi.fn(() => "blob:backup");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const { user } = renderWithUser(
      <FamilySettingsModal open onOpenChange={noop} />,
      { queryClient: seededClient() },
    );

    await user.click(screen.getByRole("button", { name: /download backup/i }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await readBlobText(blob))).toEqual(testBackupDocument);
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("restores from a chosen file after the family confirms", async () => {
    let restored: BackupDocument | null = null;
    server.use(
      http.post(`${API_BASE}/backup/restore`, async ({ request }) => {
        restored = (await request.json()) as BackupDocument;
        return HttpResponse.json({
          data: {
            members: 1,
            chores: 2,
            lists: 3,
            recipes: 4,
            meals: 5,
            events: 6,
          },
          message: "Backup restored",
        });
      }),
    );

    const { user } = renderWithUser(
      <FamilySettingsModal open onOpenChange={noop} />,
      { queryClient: seededClient() },
    );

    const file = new File(
      [JSON.stringify(testBackupDocument)],
      "familyhub-backup.json",
      { type: "application/json" },
    );
    await user.upload(screen.getByLabelText(/restore from file/i), file);

    const dialog = await screen.findByRole("dialog", {
      name: /restore this backup/i,
    });
    expect(dialog).toHaveTextContent("Test Family");
    await user.click(
      within(dialog).getByRole("button", { name: /yes, restore/i }),
    );

    await waitFor(() => expect(restored).toEqual(testBackupDocument));
    expect(await screen.findByRole("status")).toHaveTextContent(/restored/i);
  });

  it("refuses a file that is not a backup", async () => {
    const { user } = renderWithUser(
      <FamilySettingsModal open onOpenChange={noop} />,
      { queryClient: seededClient() },
    );

    // A JSON file that is not a backup: right type, wrong contents.
    const file = new File(['{"hello": "world"}'], "notes.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText(/restore from file/i), file);

    expect(
      await screen.findByText(/not a family hub backup/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /restore this backup/i }),
    ).not.toBeInTheDocument();
  });
});
