import { HttpResponse, http } from "msw";
import { formatLocalDate, parseLocalDate } from "@/lib/time-utils";
import type {
  AddMemberRequest,
  ApiResponse,
  AvatarPackDocument,
  AvatarPackSummary,
  BackupDocument,
  CalendarEventResponse,
  CategoryDeleteResult,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ChoreBoardItem,
  ChoreScopeBoard,
  ChoresBoard,
  ChoreTemplate,
  CreateChoreTemplateRequest,
  CreateEventRequest,
  CreateListCategoryRequest,
  CreateRecipeRequest,
  DuplicateMealSlotRequest,
  FamilyData,
  FamilyMember,
  FollowedTeam,
  FollowedTeamUpdate,
  InboxImport,
  InboxSenderRequest,
  InboxStatus,
  ListCategoryCatalog,
  ListCategoryManagementEntry,
  ListCategoryOption,
  ListDetail,
  ListItem,
  ListKind,
  ListPreferences,
  LoginRequest,
  LoginResponse,
  MealBoard,
  MealCollisionMode,
  MealDay,
  MealEntryRequest,
  MealSlot,
  MealSlotEntry,
  MealType,
  MoveMealSlotRequest,
  ParentPinRequest,
  Photo,
  PhotoFolderRequest,
  PhotoSource,
  PhotoSourceRequest,
  PhotoStorage,
  ProviderTeam,
  RecipeDetail,
  RecipeSummary,
  RedemptionDecisionRequest,
  RegisterRequest,
  RegisterResponse,
  RemoveMealSlotRequest,
  RenameListCategoryRequest,
  ReorderListCategoriesRequest,
  RewardShop,
  RewardWriteRequest,
  SaveMealPlanRequest,
  SportsGame,
  SportsLeague,
  SportsLeagueInfo,
  ThemePackDocument,
  ThemePackSummary,
  UpdateChoreTemplateRequest,
  UpdateCurrentPeriodCompletionRequest,
  UpdateEventRequest,
  UpdateFamilyRequest,
  UpdateMemberRequest,
  UpdateRecipeRequest,
  UpsertMealSlotRequest,
  UsernameCheckResponse,
  WeatherData,
} from "@/lib/types";
import { saveMealPlanSchema } from "@/lib/validations";

// In-memory storage for mock calendar events (reset between tests)
// Uses CalendarEventResponse (string dates) to match real API wire format
let mockEvents: CalendarEventResponse[] = [];

// In-memory storage for mock chores board (reset between tests)
let mockChoresBoard: ChoresBoard = createEmptyChoresBoard();
let mockPhotos: Photo[] = [];
let mockPhotoStorage: PhotoStorage = defaultPhotoStorage();
let mockPhotoSource: PhotoSource = defaultPhotoSource();
let mockFolderPhotoIds: string[] = [];

function defaultPhotoSource(): PhotoSource {
  return {
    folder: null,
    photoCount: 0,
    skippedHeic: 0,
    indexing: false,
    lastIndexedAt: null,
    error: null,
  };
}

function defaultPhotoStorage(): PhotoStorage {
  return {
    folder: "/photos/library",
    roots: ["/photos"],
    moving: false,
    lastMove: null,
  };
}

// In-memory storage for mock family data (reset between tests)
let mockFamily: FamilyData | null = null;

// In-memory storage for mock users (reset between tests)
interface MockUser {
  username: string;
  password: string;
  familyId: string;
}
let mockUsers: MockUser[] = [];

// In-memory storage for persisted family lists (reset between tests)
let mockLists: ListDetail[] = [];
let mockListPreferences: ListPreferences = { showCompletedByDefault: true };

// Shared category catalog per kind — every list of a kind derives its categories
// from here rather than owning a private catalog (matches BE v1.7.0 behaviour).
let mockCategoryCatalogs: Record<ListKind, ListCategoryOption[]> =
  createDefaultCategoryCatalogs();

let mockRecipes: RecipeDetail[] = [];
let mockWeather: WeatherData | null = null;
interface MockThemePack {
  id: string;
  document: ThemePackDocument;
  createdAt: string;
}
let mockThemePacks: MockThemePack[] = [];
let mockThemePackIdCounter = 1;

interface MockAvatarPack {
  id: string;
  document: AvatarPackDocument;
  createdAt: string;
}
let mockAvatarPacks: MockAvatarPack[] = [];

/** The rewards shop; "2468" is the parent PIN these mocks accept, as elsewhere. */
let mockRewardShop: RewardShop = { rewards: [], waiting: [] };
let mockRewardIdCounter = 1;
const MOCK_PARENT_PIN = "2468";

/** Followed teams and their games; empty unless a test seeds them. */
let mockSports: {
  leagues: SportsLeagueInfo[];
  teams: ProviderTeam[];
  followed: FollowedTeam[];
  games: SportsGame[];
  live: SportsGame[];
} = emptySports();

function emptySports() {
  return {
    leagues: [
      { league: "NFL" as const, name: "NFL", available: false },
      { league: "MLB" as const, name: "MLB", available: true },
      {
        league: "COLLEGE_FOOTBALL" as const,
        name: "College football",
        available: false,
      },
      {
        league: "MENS_COLLEGE_BASKETBALL" as const,
        name: "Men's college basketball",
        available: false,
      },
    ],
    teams: [] as ProviderTeam[],
    followed: [] as FollowedTeam[],
    games: [] as SportsGame[],
    live: [] as SportsGame[],
  };
}
let mockAvatarPackIdCounter = 1;

function mockPackRecipe(
  id: string,
  title: string,
  tags: string[],
): RecipeDetail {
  return {
    id,
    title,
    imageUrl: null,
    favorite: false,
    tags,
    updatedAt: "2026-05-17T09:00:00Z",
    ingredients: ["1 onion", "2 tbsp olive oil"],
    instructions: ["Cook."],
    note: "Prep 10 min · Cook 20 min · Serves 4.",
    sourceUrl: null,
  };
}

const MOCK_RECIPE_PACKS = [
  {
    id: "starter",
    name: "Starter recipes",
    description:
      "Family favourites, many on the grill, that most kids will eat.",
    recipeCount: 26,
    recipes: [
      mockPackRecipe("starter-fajitas", "Sheet-Pan Chicken Fajitas", [
        "starter",
        "chicken",
      ]),
      mockPackRecipe("starter-salmon", "Honey-Soy Grilled Salmon", [
        "starter",
        "grill",
      ]),
    ],
  },
  {
    id: "quick-healthy",
    name: "Quick & healthy",
    description:
      "Weeknight meals in 40 minutes or less: lean proteins, vegetables and whole grains.",
    recipeCount: 25,
    recipes: [
      mockPackRecipe("qh-curry", "Chickpea and Spinach Curry", [
        "quick & healthy",
        "vegetarian",
      ]),
      mockPackRecipe("qh-shrimp", "Garlic Shrimp with Zucchini Noodles", [
        "quick & healthy",
        "seafood",
      ]),
    ],
  },
];

let mockBackupDocument: BackupDocument = {
  version: 1,
  exportedAt: "2026-10-23T18:00:00Z",
  family: { name: "Test Family" },
};
let mockMealsBoards: Record<string, MealBoard> = {};
let mockIdCounter = 1000;
let mockCategoryIdCounter = 2000;
let mockRecipeIdCounter = 1000;
let mockMealSlotIdCounter = 1000;
let mockMealEntryIdCounter = 1000;
const MOCK_TIMESTAMP = "2026-05-06T09:00:00";
const MOCK_RECIPE_TIMESTAMP = "2026-06-04T09:00:00";
const MOCK_IMPORTED_RECIPE: RecipeDetail = {
  id: "00000000-0000-4000-8000-000000000502",
  title: "Imported Tomato Soup",
  imageUrl: null,
  ingredients: ["Tomatoes", "Stock", "Cream"],
  instructions: ["Simmer tomatoes and stock", "Blend with cream"],
  note: null,
  sourceUrl: "https://example.com/imported-tomato-soup",
  tags: ["lunch", "quick"],
  favorite: false,
  updatedAt: MOCK_RECIPE_TIMESTAMP,
};

function createEmptyChoresBoard(): ChoresBoard {
  return {
    timezone: "America/Los_Angeles",
    today: {
      scope: "TODAY",
      periodStartDate: "2026-05-17",
      periodEndDate: "2026-05-17",
      summary: { total: 0, completed: 0, remaining: 0 },
      assignees: [],
    },
    thisWeek: {
      scope: "THIS_WEEK",
      periodStartDate: "2026-05-17",
      periodEndDate: "2026-05-23",
      summary: { total: 0, completed: 0, remaining: 0 },
      assignees: [],
    },
    thisMonth: {
      scope: "THIS_MONTH",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      summary: { total: 0, completed: 0, remaining: 0 },
      assignees: [],
    },
  };
}

function createDefaultCategoryCatalogs(): Record<
  ListKind,
  ListCategoryOption[]
> {
  return {
    grocery: [
      {
        id: "00000000-0000-4000-8000-000000000301",
        kind: "grocery",
        name: "Produce",
        sortOrder: 0,
      },
      {
        id: "00000000-0000-4000-8000-000000000302",
        kind: "grocery",
        name: "Dairy",
        sortOrder: 1,
      },
      {
        id: "00000000-0000-4000-8000-000000000303",
        kind: "grocery",
        name: "Pantry",
        sortOrder: 2,
      },
      {
        id: "00000000-0000-4000-8000-000000000304",
        kind: "grocery",
        name: "Frozen",
        sortOrder: 3,
      },
      {
        id: "00000000-0000-4000-8000-000000000305",
        kind: "grocery",
        name: "Household",
        sortOrder: 4,
      },
    ],
    "to-do": [
      {
        id: "00000000-0000-4000-8000-000000000401",
        kind: "to-do",
        name: "Urgent",
        sortOrder: 0,
      },
      {
        id: "00000000-0000-4000-8000-000000000402",
        kind: "to-do",
        name: "Soon",
        sortOrder: 1,
      },
      {
        id: "00000000-0000-4000-8000-000000000403",
        kind: "to-do",
        name: "Later",
        sortOrder: 2,
      },
    ],
    general: [],
  };
}

/**
 * Reset mock data between tests
 */
export function resetMockEvents(): void {
  mockEvents = [];
}

/**
 * Seed mock events for testing.
 * Accepts CalendarEventResponse (string dates) to match real API wire format.
 */
export function seedMockEvents(events: CalendarEventResponse[]): void {
  mockEvents = [...events];
}

/**
 * Get current mock events (for assertions)
 */
export function getMockEvents(): CalendarEventResponse[] {
  return [...mockEvents];
}

/**
 * Reset mock chores board between tests.
 */
/** Reset the mock photo library between tests. */
/** Seeds where the photos live. */
export function seedMockPhotoStorage(storage: Partial<PhotoStorage>): void {
  mockPhotoStorage = { ...mockPhotoStorage, ...storage };
}

/** Seeds the folder of existing photos and the ids its sample returns. */
export function seedMockPhotoSource(
  source: Partial<PhotoSource>,
  folderPhotoIds: string[] = [],
): void {
  mockPhotoSource = { ...mockPhotoSource, ...source };
  mockFolderPhotoIds = folderPhotoIds;
}

// The family inbox: its state as GET /inbox returns it.
function defaultInbox(): InboxStatus {
  return {
    configured: false,
    address: null,
    readerAvailable: false,
    lastReadAt: null,
    lastError: null,
    memberAddresses: [],
    extraSenders: [],
    waiting: 0,
    imports: [],
  };
}

let mockInbox: InboxStatus = defaultInbox();

/** Seeds the family inbox; waiting is counted from the pending imports given. */
export function seedMockInbox(inbox: Partial<InboxStatus>): void {
  mockInbox = { ...mockInbox, ...inbox };
  mockInbox.waiting = mockInbox.imports.filter(
    (item) => item.status === "PENDING",
  ).length;
}

export function resetMockInbox(): void {
  mockInbox = defaultInbox();
}

function decideMockInboxImport(
  id: string,
  status: InboxImport["status"],
): InboxImport | undefined {
  const item = mockInbox.imports.find((candidate) => candidate.id === id);
  if (!item) return undefined;
  const decided: InboxImport = {
    ...item,
    status,
    proposal: null,
    decidedAt: new Date().toISOString(),
  };
  seedMockInbox({
    imports: mockInbox.imports.map((candidate) =>
      candidate.id === id ? decided : candidate,
    ),
  });
  return decided;
}

export function resetMockPhotos(): void {
  mockPhotoSource = defaultPhotoSource();
  mockFolderPhotoIds = [];
  mockPhotoStorage = defaultPhotoStorage();
  mockPhotos = [];
}

/** The mock photo library, for assertions. */
export function getMockPhotos(): Photo[] {
  return structuredClone(mockPhotos);
}

/** Seed the mock photo library. */
export function seedMockPhotos(photos: Photo[]): void {
  mockPhotos = structuredClone(photos);
}

export function resetMockChoresBoard(): void {
  mockChoresBoard = createEmptyChoresBoard();
}

/**
 * Seed mock chores board for testing.
 */
export function seedMockChoresBoard(board: ChoresBoard): void {
  mockChoresBoard = structuredClone(board);
}

/**
 * Get current mock chores board for assertions.
 */
export function getMockChoresBoard(): ChoresBoard {
  return structuredClone(mockChoresBoard);
}

/**
 * Reset mock family data between tests
 */
export function resetMockFamily(): void {
  mockFamily = null;
}

/**
 * Reset mock users between tests
 */
export function resetMockUsers(): void {
  mockUsers = [];
}

/**
 * Seed mock family for testing
 */
export function seedMockFamily(family: FamilyData | null): void {
  mockFamily = family;
}

/**
 * Get current mock family (for assertions)
 */
export function getMockFamily(): FamilyData | null {
  return mockFamily;
}

/**
 * Reset mock list data between tests.
 */
export function resetMockLists(): void {
  mockLists = [];
  mockListPreferences = { showCompletedByDefault: true };
  mockCategoryCatalogs = createDefaultCategoryCatalogs();
  mockIdCounter = 1000;
  mockCategoryIdCounter = 2000;
}

/**
 * Seed the mock category catalog for a given kind (overrides the default).
 * Used in tests that need specific category IDs/names.
 */
export function seedMockCategoryCatalog(
  kind: ListKind,
  categories: ListCategoryOption[],
): void {
  mockCategoryCatalogs[kind] = categories.map((c, idx) => ({
    ...c,
    sortOrder: idx,
  }));
}

/**
 * Seed mock list details for testing.
 */
export function seedMockLists(lists: ListDetail[]): void {
  mockLists = lists.map((list) => ({ ...list, items: [...list.items] }));
}

/**
 * Seed mock list preferences for testing.
 */
export function seedMockListPreferences(preferences: ListPreferences): void {
  mockListPreferences = preferences;
}

/**
 * Reset mock recipe data between tests.
 */
export function seedMockBackupDocument(document: BackupDocument): void {
  mockBackupDocument = document;
}

export function resetMockWeather(): void {
  mockWeather = null;
}

export function seedMockWeather(weather: WeatherData | null): void {
  mockWeather = weather;
}

export function resetMockSports(): void {
  mockSports = emptySports();
}

/** Seeds the sports mocks; anything left out stays as it is. */
export function seedMockSports(seed: Partial<typeof mockSports>): void {
  mockSports = { ...mockSports, ...structuredClone(seed) };
}

export function resetMockRewards(): void {
  mockRewardShop = { rewards: [], waiting: [] };
  mockRewardIdCounter = 1;
}

/** Seeds the shop: rewards on offer and asks waiting. */
export function seedMockRewardShop(shop: RewardShop): void {
  mockRewardShop = structuredClone(shop);
}

function wrongPin() {
  return HttpResponse.json(
    { message: "Wrong PIN for Mom. 4 tries left." },
    { status: 403 },
  );
}

export function resetMockAvatarPacks(): void {
  mockAvatarPacks = [];
  mockAvatarPackIdCounter = 1;
}

/** Seeds imported avatar packs; ids are avatars-1, avatars-2, … in order. */
export function seedMockAvatarPacks(documents: AvatarPackDocument[]): void {
  mockAvatarPacks = documents.map((document) => ({
    id: `avatars-${mockAvatarPackIdCounter++}`,
    document: structuredClone(document),
    createdAt: "2026-10-27T12:00:00Z",
  }));
}

function avatarPackSummary(pack: MockAvatarPack): AvatarPackSummary {
  const groups: string[] = [];
  for (const character of pack.document.characters) {
    const group = character.group ?? pack.document.name;
    if (!groups.includes(group)) groups.push(group);
  }
  return {
    id: pack.id,
    name: pack.document.name,
    characterCount: pack.document.characters.length,
    groups,
    sizeBytes: JSON.stringify(pack.document).length,
    createdAt: pack.createdAt,
  };
}

export function resetMockThemePacks(): void {
  mockThemePacks = [];
  mockThemePackIdCounter = 1;
}

/** Seeds imported packs; ids are pack-1, pack-2, … in order. */
export function seedMockThemePacks(documents: ThemePackDocument[]): void {
  mockThemePacks = documents.map((document) => ({
    id: `pack-${mockThemePackIdCounter++}`,
    document: structuredClone(document),
    createdAt: "2026-10-23T12:00:00Z",
  }));
}

function themePackSummary(pack: MockThemePack): ThemePackSummary {
  const tokens = pack.document.tokens;
  const images = pack.document.images ?? {};
  const thumbnailKey = pack.document.slots?.thumbnail ?? "background";
  return {
    id: pack.id,
    name: pack.document.name,
    dark: pack.document.dark,
    sizeBytes: JSON.stringify(pack.document).length,
    createdAt: pack.createdAt,
    preview: {
      background: tokens["--background"] ?? null,
      card: tokens["--card"] ?? null,
      primary: tokens["--primary"] ?? null,
      foreground: tokens["--foreground"] ?? null,
      accent: tokens["--accent"] ?? null,
      thumbnail: images[thumbnailKey] ?? null,
    },
  };
}

export function resetMockRecipes(): void {
  mockRecipes = [];
  mockRecipeIdCounter = 1000;
}

/**
 * Seed mock recipe details for testing.
 */
export function seedMockRecipes(recipes: RecipeDetail[]): void {
  mockRecipes = recipes.map((recipe) => structuredClone(recipe));
}

/**
 * Reset mock meals data between tests.
 */
export function resetMockMeals(): void {
  mockMealsBoards = {};
  mockMealSlotIdCounter = 1000;
  mockMealEntryIdCounter = 1000;
}

/**
 * Seed one mock meals board for testing.
 */
export function seedMockMealsBoard(board: MealBoard): void {
  mockMealsBoards[board.weekStartDate] = structuredClone(board);
}

/**
 * Read one mock meals board for assertions.
 */
export function getMockMealsBoard(weekStartDate: string): MealBoard {
  return structuredClone(getMealsBoard(weekStartDate));
}

function createMockId(): string {
  mockIdCounter += 1;
  return `00000000-0000-4000-8000-${String(mockIdCounter).padStart(12, "0")}`;
}

function createMockCategoryId(): string {
  mockCategoryIdCounter += 1;
  return `00000000-0000-4000-8000-${String(mockCategoryIdCounter).padStart(12, "0")}`;
}

function createMockRecipeId(): string {
  mockRecipeIdCounter += 1;
  return `00000000-0000-4000-8000-${String(mockRecipeIdCounter).padStart(12, "0")}`;
}

function createMockMealSlotId(): string {
  mockMealSlotIdCounter += 1;
  return `00000000-0000-4000-8000-${String(mockMealSlotIdCounter).padStart(12, "0")}`;
}

function createMockMealEntryId(): string {
  mockMealEntryIdCounter += 1;
  return `00000000-0000-4000-8000-${String(mockMealEntryIdCounter).padStart(12, "0")}`;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedRecipeImportUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const protocolAllowed =
      url.protocol === "http:" || url.protocol === "https:";
    if (!protocolAllowed) return true;

    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost") ||
      isPrivateIpv4(hostname)
    );
  } catch {
    return true;
  }
}

function categoriesForKind(kind: ListKind): ListCategoryOption[] {
  return [...mockCategoryCatalogs[kind]];
}

function buildCatalog(kind: ListKind): ListCategoryCatalog {
  const categories = mockCategoryCatalogs[kind];
  const groupedListCount = mockLists.filter(
    (l) => l.kind === kind && l.categoryDisplayMode === "grouped",
  ).length;
  const managementEntries: ListCategoryManagementEntry[] = categories.map(
    (cat) => ({
      ...cat,
      itemCount: mockLists
        .filter((l) => l.kind === kind)
        .reduce(
          (sum, l) =>
            sum + l.items.filter((item) => item.categoryId === cat.id).length,
          0,
        ),
    }),
  );
  return { kind, groupedListCount, categories: managementEntries };
}

function normalizeForDuplicate(name: string): string {
  return name.trim().toLowerCase();
}

function recalculateScopeSummary(scope: ChoreScopeBoard): ChoreScopeBoard {
  const assignees = scope.assignees.map((group) => {
    const completed = group.chores.filter((chore) => chore.completed).length;
    const total = group.chores.length;

    return {
      ...group,
      summary: {
        total,
        completed,
        remaining: total - completed,
      },
    };
  });
  const total = assignees.reduce((sum, group) => sum + group.summary.total, 0);
  const completed = assignees.reduce(
    (sum, group) => sum + group.summary.completed,
    0,
  );

  return {
    ...scope,
    assignees,
    summary: {
      total,
      completed,
      remaining: total - completed,
    },
  };
}

function updateBoardItem(
  templateId: string,
  update: (item: ChoreBoardItem) => ChoreBoardItem,
): ChoreBoardItem | null {
  let updatedItem: ChoreBoardItem | null = null;

  mockChoresBoard = {
    ...mockChoresBoard,
    today: recalculateScopeSummary({
      ...mockChoresBoard.today,
      assignees: mockChoresBoard.today.assignees.map((group) => ({
        ...group,
        chores: group.chores.map((item) => {
          if (item.templateId !== templateId) {
            return item;
          }
          updatedItem = update(item);
          return updatedItem;
        }),
      })),
    }),
    thisWeek: recalculateScopeSummary({
      ...mockChoresBoard.thisWeek,
      assignees: mockChoresBoard.thisWeek.assignees.map((group) => ({
        ...group,
        chores: group.chores.map((item) => {
          if (item.templateId !== templateId) {
            return item;
          }
          updatedItem = update(item);
          return updatedItem;
        }),
      })),
    }),
    thisMonth: recalculateScopeSummary({
      ...mockChoresBoard.thisMonth,
      assignees: mockChoresBoard.thisMonth.assignees.map((group) => ({
        ...group,
        chores: group.chores.map((item) => {
          if (item.templateId !== templateId) {
            return item;
          }
          updatedItem = update(item);
          return updatedItem;
        }),
      })),
    }),
  };

  return updatedItem;
}

function removeBoardItem(templateId: string): void {
  mockChoresBoard = {
    ...mockChoresBoard,
    today: recalculateScopeSummary({
      ...mockChoresBoard.today,
      assignees: mockChoresBoard.today.assignees.map((group) => ({
        ...group,
        chores: group.chores.filter((item) => item.templateId !== templateId),
      })),
    }),
    thisWeek: recalculateScopeSummary({
      ...mockChoresBoard.thisWeek,
      assignees: mockChoresBoard.thisWeek.assignees.map((group) => ({
        ...group,
        chores: group.chores.filter((item) => item.templateId !== templateId),
      })),
    }),
    thisMonth: recalculateScopeSummary({
      ...mockChoresBoard.thisMonth,
      assignees: mockChoresBoard.thisMonth.assignees.map((group) => ({
        ...group,
        chores: group.chores.filter((item) => item.templateId !== templateId),
      })),
    }),
  };
}

function toListSummary(list: ListDetail) {
  return {
    id: list.id,
    name: list.name,
    kind: list.kind,
    totalItems: list.items.length,
    completedItems: list.items.filter((item) => item.completed).length,
  };
}

function toRecipeSummary(recipe: RecipeDetail): RecipeSummary {
  return {
    id: recipe.id,
    title: recipe.title,
    imageUrl: recipe.imageUrl,
    favorite: recipe.favorite,
    tags: recipe.tags,
    updatedAt: recipe.updatedAt,
  };
}

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

function createEmptyMealSlot(
  weekStartDate: string,
  dayIndex: number,
  mealType: MealType,
): MealSlot {
  return {
    id: null,
    weekStartDate,
    dayIndex,
    mealType,
    primary: null,
    extras: [],
    note: null,
  };
}

function createEmptyMealDay(weekStartDate: string, dayIndex: number): MealDay {
  const date = parseLocalDate(weekStartDate);
  date.setDate(date.getDate() + dayIndex);

  return {
    date: formatLocalDate(date),
    dayIndex,
    slots: MEAL_TYPES.map((mealType) =>
      createEmptyMealSlot(weekStartDate, dayIndex, mealType),
    ),
  };
}

function createEmptyMealsBoard(weekStartDate: string): MealBoard {
  return {
    weekStartDate,
    days: Array.from({ length: 7 }, (_, dayIndex) =>
      createEmptyMealDay(weekStartDate, dayIndex),
    ),
  };
}

function getMealsBoard(weekStartDate: string): MealBoard {
  if (!mockMealsBoards[weekStartDate]) {
    mockMealsBoards[weekStartDate] = createEmptyMealsBoard(weekStartDate);
  }

  return mockMealsBoards[weekStartDate];
}

function findMealSlot(
  board: MealBoard,
  dayIndex: number,
  mealType: MealType,
): MealSlot {
  const day = board.days[dayIndex];
  if (!day) {
    throw new Error(
      `No day at index ${dayIndex} in board ${board.weekStartDate}`,
    );
  }
  const slot = day.slots.find((s) => s.mealType === mealType);
  if (!slot) {
    throw new Error(
      `No ${mealType} slot on day ${dayIndex} in board ${board.weekStartDate}`,
    );
  }
  return slot;
}

function isMealSlotOccupied(slot: MealSlot): boolean {
  return Boolean(slot.primary) || slot.extras.length > 0;
}

function setMealSlot(board: MealBoard, updatedSlot: MealSlot): void {
  const day = board.days[updatedSlot.dayIndex];
  day.slots = day.slots.map((slot) =>
    slot.mealType === updatedSlot.mealType ? updatedSlot : slot,
  );
}

function cloneMealEntry(entry: MealSlotEntry, role: MealSlotEntry["role"]) {
  return {
    ...structuredClone(entry),
    id: createMockMealEntryId(),
    role,
  };
}

function snapshotMealEntry(
  request: MealEntryRequest,
  role: MealSlotEntry["role"],
): MealSlotEntry | HttpResponse {
  if (request.sourceType === "recipe") {
    const recipe = mockRecipes.find(
      (candidate) => candidate.id === request.recipeId,
    );
    if (!recipe) {
      return HttpResponse.json(
        { message: `Recipe with id "${request.recipeId}" not found` },
        { status: 404 },
      );
    }

    return {
      id: createMockMealEntryId(),
      role,
      sourceType: "recipe",
      recipeId: recipe.id,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      note: recipe.note,
    };
  }

  const title = request.title?.trim() ?? "";
  if (!title) {
    return HttpResponse.json(
      { message: "Quick meal title is required" },
      { status: 400 },
    );
  }

  return {
    id: createMockMealEntryId(),
    role,
    sourceType: "quick",
    recipeId: null,
    title,
    imageUrl: request.imageUrl ?? null,
    note: request.note ?? null,
  };
}

function clearMealSlot(slot: MealSlot): MealSlot {
  return {
    ...slot,
    primary: null,
    extras: [],
    note: null,
  };
}

function resolveMealSlotPlacement(
  slot: MealSlot,
  primary: MealSlotEntry,
  extras: MealSlotEntry[],
  note: string | null,
  collisionMode: MealCollisionMode | null,
): MealSlot | HttpResponse {
  const id = slot.id ?? createMockMealSlotId();

  if (!slot.primary && slot.extras.length > 0 && collisionMode !== null) {
    return HttpResponse.json(
      { message: "Meal slot already has content" },
      { status: 409 },
    );
  }

  if (slot.primary && collisionMode === null) {
    return HttpResponse.json(
      { message: "Meal slot already has a primary meal" },
      { status: 409 },
    );
  }

  if (slot.primary && collisionMode === "add_as_extra") {
    return {
      ...slot,
      id,
      extras: [...slot.extras, { ...primary, role: "extra" }, ...extras],
      note,
    };
  }

  return {
    ...slot,
    id,
    primary: { ...primary, role: "primary" },
    extras,
    note,
  };
}

function snapshotRequestedEntries(
  primaryRequest: MealEntryRequest,
  extraRequests: MealEntryRequest[] = [],
): { primary: MealSlotEntry; extras: MealSlotEntry[] } | HttpResponse {
  const primary = snapshotMealEntry(primaryRequest, "primary");
  if (primary instanceof HttpResponse) return primary;

  const extras: MealSlotEntry[] = [];
  for (const extraRequest of extraRequests) {
    const extra = snapshotMealEntry(extraRequest, "extra");
    if (extra instanceof HttpResponse) return extra;
    extras.push(extra);
  }

  return { primary, extras };
}

function createApiResponse<T>(data: T, message?: string): ApiResponse<T> {
  return message ? { data, message } : { data };
}

// Base URL for API endpoints — must match vitest.config.ts VITE_API_BASE_URL
export const API_BASE = "http://localhost:3000/api";

/**
 * MSW request handlers for calendar API endpoints.
 *
 * Usage in tests:
 * ```typescript
 * import { server, seedMockEvents, resetMockEvents } from "@/test/mocks/server";
 *
 * beforeEach(() => {
 *   seedMockEvents([testEvent]);
 * });
 *
 * afterEach(() => {
 *   resetMockEvents();
 * });
 * ```
 *
 * Override handlers for error scenarios:
 * ```typescript
 * server.use(
 *   http.get("http://localhost:3000/api/calendar/events", () => {
 *     return HttpResponse.json({ message: "Server error" }, { status: 500 });
 *   })
 * );
 * ```
 */
export const handlers = [
  // ============================================================================
  // Meals API Handlers
  // ============================================================================

  // GET /meals/board - Week board
  http.get(`${API_BASE}/meals/board`, ({ request }) => {
    const url = new URL(request.url);
    const weekStartDate = url.searchParams.get("weekStartDate");
    if (!weekStartDate) {
      return HttpResponse.json(
        { message: "weekStartDate is required" },
        { status: 400 },
      );
    }

    return HttpResponse.json(createApiResponse(getMealsBoard(weekStartDate)));
  }),

  // POST /meals/plans - Save a focused meal planning session
  http.post(`${API_BASE}/meals/plans`, async ({ request }) => {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return HttpResponse.json(
        { message: "Invalid meal plan request" },
        { status: 400 },
      );
    }

    const parsedBody = saveMealPlanSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return HttpResponse.json(
        { message: "Invalid meal plan request" },
        { status: 400 },
      );
    }

    const body = parsedBody.data;
    const board = getMealsBoard(body.weekStartDate);
    const seenTargets = new Set<string>();
    const targets: Array<{
      slot: MealSlot;
      requestSlot: SaveMealPlanRequest["slots"][number];
    }> = [];

    for (const requestSlot of body.slots) {
      const targetKey = `${requestSlot.dayIndex}:${requestSlot.mealType}`;
      if (seenTargets.has(targetKey)) {
        return HttpResponse.json(
          { message: "Meal plan contains duplicate target slots." },
          { status: 400 },
        );
      }
      seenTargets.add(targetKey);

      const slot = findMealSlot(
        board,
        requestSlot.dayIndex,
        requestSlot.mealType,
      );
      targets.push({ slot, requestSlot });
    }

    if (targets.some(({ slot }) => isMealSlotOccupied(slot))) {
      return HttpResponse.json(
        { message: "Some meal slots are no longer empty." },
        { status: 409 },
      );
    }

    const updates: MealSlot[] = [];
    for (const { slot, requestSlot } of targets) {
      const entries = snapshotRequestedEntries(
        requestSlot.primary,
        requestSlot.extras,
      );
      if (entries instanceof HttpResponse) return entries;

      const updatedSlot = resolveMealSlotPlacement(
        slot,
        entries.primary,
        entries.extras,
        requestSlot.note ?? null,
        null,
      );
      if (updatedSlot instanceof HttpResponse) return updatedSlot;
      updates.push(updatedSlot);
    }

    for (const updatedSlot of updates) {
      setMealSlot(board, updatedSlot);
    }

    return HttpResponse.json(
      createApiResponse(board, "Meal plan saved successfully"),
    );
  }),

  // PUT /meals/slots - Create or update one slot
  http.put(`${API_BASE}/meals/slots`, async ({ request }) => {
    const body = (await request.json()) as UpsertMealSlotRequest;
    const board = getMealsBoard(body.weekStartDate);
    const slot = findMealSlot(board, body.dayIndex, body.mealType);
    const entries = snapshotRequestedEntries(body.primary, body.extras);
    if (entries instanceof HttpResponse) return entries;

    const updatedSlot = resolveMealSlotPlacement(
      slot,
      entries.primary,
      entries.extras,
      body.note ?? null,
      body.collisionMode,
    );
    if (updatedSlot instanceof HttpResponse) return updatedSlot;

    setMealSlot(board, updatedSlot);

    return HttpResponse.json(
      createApiResponse(updatedSlot, "Meal slot updated successfully"),
    );
  }),

  // POST /meals/slots/move - Move a planned meal block
  http.post(`${API_BASE}/meals/slots/move`, async ({ request }) => {
    const body = (await request.json()) as MoveMealSlotRequest;
    const sourceBoard = getMealsBoard(body.sourceWeekStartDate);
    const destinationBoard = getMealsBoard(body.destinationWeekStartDate);
    const sourceSlot = findMealSlot(
      sourceBoard,
      body.sourceDayIndex,
      body.sourceMealType,
    );
    const destinationSlot = findMealSlot(
      destinationBoard,
      body.destinationDayIndex,
      body.destinationMealType,
    );

    if (!sourceSlot.primary) {
      return HttpResponse.json(
        { message: "Source meal slot is empty" },
        { status: 404 },
      );
    }

    const updatedDestination = resolveMealSlotPlacement(
      destinationSlot,
      cloneMealEntry(sourceSlot.primary, "primary"),
      sourceSlot.extras.map((extra) => cloneMealEntry(extra, "extra")),
      sourceSlot.note,
      body.collisionMode,
    );
    if (updatedDestination instanceof HttpResponse) return updatedDestination;

    setMealSlot(destinationBoard, updatedDestination);
    setMealSlot(sourceBoard, clearMealSlot(sourceSlot));

    return HttpResponse.json(
      createApiResponse(destinationBoard, "Meal slot moved successfully"),
    );
  }),

  // POST /meals/slots/duplicate - Duplicate a planned meal block
  http.post(`${API_BASE}/meals/slots/duplicate`, async ({ request }) => {
    const body = (await request.json()) as DuplicateMealSlotRequest;
    const sourceBoard = getMealsBoard(body.sourceWeekStartDate);
    const destinationBoard = getMealsBoard(body.destinationWeekStartDate);
    const sourceSlot = findMealSlot(
      sourceBoard,
      body.sourceDayIndex,
      body.sourceMealType,
    );
    const destinationSlot = findMealSlot(
      destinationBoard,
      body.destinationDayIndex,
      body.destinationMealType,
    );

    if (!sourceSlot.primary) {
      return HttpResponse.json(
        { message: "Source meal slot is empty" },
        { status: 404 },
      );
    }

    const updatedDestination = resolveMealSlotPlacement(
      destinationSlot,
      cloneMealEntry(sourceSlot.primary, "primary"),
      sourceSlot.extras.map((extra) => cloneMealEntry(extra, "extra")),
      sourceSlot.note,
      body.collisionMode,
    );
    if (updatedDestination instanceof HttpResponse) return updatedDestination;

    setMealSlot(destinationBoard, updatedDestination);

    return HttpResponse.json(
      createApiResponse(destinationBoard, "Meal slot duplicated successfully"),
    );
  }),

  // DELETE /meals/slots - Remove one planned slot.
  // Mirrors the released backend: the payload is a validated @RequestBody, not
  // query parameters. An absent or malformed body is a 400, exactly as
  // production rejects it.
  http.delete(`${API_BASE}/meals/slots`, async ({ request }) => {
    let body: Partial<RemoveMealSlotRequest> | null = null;
    try {
      body = (await request.json()) as RemoveMealSlotRequest;
    } catch {
      body = null;
    }

    const weekStartDate = body?.weekStartDate;
    const dayIndex = body?.dayIndex;
    const mealType = body?.mealType;

    if (
      !weekStartDate ||
      dayIndex === undefined ||
      dayIndex === null ||
      !mealType
    ) {
      return HttpResponse.json(
        { message: "weekStartDate, dayIndex, and mealType are required" },
        { status: 400 },
      );
    }

    const board = getMealsBoard(weekStartDate);
    const slot = findMealSlot(board, dayIndex, mealType);
    setMealSlot(board, clearMealSlot(slot));

    return HttpResponse.json(
      createApiResponse(board, "Meal slot removed successfully"),
    );
  }),

  // ============================================================================
  // Recipes API Handlers
  // ============================================================================

  // GET /recipes - Library summaries
  http.get(`${API_BASE}/recipes`, () => {
    return HttpResponse.json(
      createApiResponse(mockRecipes.map(toRecipeSummary)),
    );
  }),

  // The pack routes sit before /recipes/:id, which would otherwise match "packs".
  // GET /recipes/packs - the bundled recipe packs
  http.get(`${API_BASE}/recipes/packs`, () => {
    return HttpResponse.json(
      createApiResponse(
        MOCK_RECIPE_PACKS.map(({ id, name, description, recipeCount }) => ({
          id,
          name,
          description,
          recipeCount,
        })),
      ),
    );
  }),

  // POST /recipes/packs/:id - add a pack's recipes not yet in the library
  http.post(`${API_BASE}/recipes/packs/:packId`, ({ params }) => {
    const pack = MOCK_RECIPE_PACKS.find((p) => p.id === params.packId);
    if (!pack) {
      return HttpResponse.json(
        { message: `Recipe pack not found: ${params.packId}` },
        { status: 404 },
      );
    }
    const existing = new Set(mockRecipes.map((r) => r.title.toLowerCase()));
    const added = pack.recipes.filter(
      (r) => !existing.has(r.title.toLowerCase()),
    );
    mockRecipes = [...added.map((r) => structuredClone(r)), ...mockRecipes];
    return HttpResponse.json(
      createApiResponse(
        { added: added.length, skipped: pack.recipes.length - added.length },
        "Recipe pack added",
      ),
    );
  }),

  // GET /recipes/:id - Detail payload
  http.get(`${API_BASE}/recipes/:id`, ({ params }) => {
    const recipe = mockRecipes.find((candidate) => candidate.id === params.id);
    if (!recipe) {
      return HttpResponse.json(
        { message: `Recipe with id "${params.id}" not found` },
        { status: 404 },
      );
    }

    return HttpResponse.json(createApiResponse(recipe));
  }),

  // POST /recipes - Create a saved recipe
  http.post(`${API_BASE}/recipes`, async ({ request }) => {
    const body = (await request.json()) as CreateRecipeRequest;
    const recipe: RecipeDetail = {
      id: createMockRecipeId(),
      title: body.title.trim(),
      imageUrl: body.imageUrl ?? null,
      ingredients: body.ingredients ?? [],
      instructions: body.instructions ?? [],
      note: body.note ?? null,
      sourceUrl: body.sourceUrl ?? null,
      tags: body.tags ?? [],
      favorite: body.favorite ?? false,
      updatedAt: MOCK_RECIPE_TIMESTAMP,
    };

    mockRecipes = [recipe, ...mockRecipes];

    return HttpResponse.json(
      createApiResponse(recipe, "Recipe created successfully"),
      { status: 201 },
    );
  }),

  // PATCH /recipes/:id - Update a saved recipe
  http.patch(`${API_BASE}/recipes/:id`, async ({ params, request }) => {
    const index = mockRecipes.findIndex(
      (candidate) => candidate.id === params.id,
    );
    if (index === -1) {
      return HttpResponse.json(
        { message: `Recipe with id "${params.id}" not found` },
        { status: 404 },
      );
    }

    const body = (await request.json()) as UpdateRecipeRequest;
    const current = mockRecipes[index];
    const updated: RecipeDetail = {
      ...current,
      ...body,
      title: body.title?.trim() ?? current.title,
      imageUrl: body.imageUrl === undefined ? current.imageUrl : body.imageUrl,
      ingredients: body.ingredients ?? current.ingredients,
      instructions: body.instructions ?? current.instructions,
      note: body.note === undefined ? current.note : body.note,
      sourceUrl:
        body.sourceUrl === undefined ? current.sourceUrl : body.sourceUrl,
      tags: body.tags ?? current.tags,
      favorite: body.favorite ?? current.favorite,
      updatedAt: MOCK_RECIPE_TIMESTAMP,
    };

    mockRecipes = [
      ...mockRecipes.slice(0, index),
      updated,
      ...mockRecipes.slice(index + 1),
    ];

    return HttpResponse.json(
      createApiResponse(updated, "Recipe updated successfully"),
    );
  }),

  // POST /recipes/import - Import from URL and persist
  http.post(`${API_BASE}/recipes/import`, async ({ request }) => {
    const body = (await request.json()) as { url: string };
    if (
      body.url === "https://example.com/import-error" ||
      isBlockedRecipeImportUrl(body.url)
    ) {
      return HttpResponse.json(
        { message: "Could not import recipe" },
        { status: 400 },
      );
    }

    const imported: RecipeDetail = {
      ...MOCK_IMPORTED_RECIPE,
      id: mockRecipes.some((recipe) => recipe.id === MOCK_IMPORTED_RECIPE.id)
        ? createMockRecipeId()
        : MOCK_IMPORTED_RECIPE.id,
      sourceUrl: body.url,
    };

    mockRecipes = [imported, ...mockRecipes];

    return HttpResponse.json(
      createApiResponse(imported, "Recipe imported successfully"),
      { status: 201 },
    );
  }),

  // ============================================================================
  // Lists API Handlers
  // ============================================================================

  // GET /lists/preferences - Family-wide completed item visibility default
  http.get(`${API_BASE}/lists/preferences`, () => {
    return HttpResponse.json(createApiResponse(mockListPreferences));
  }),

  // PATCH /lists/preferences - Update family-wide completed visibility default
  http.patch(`${API_BASE}/lists/preferences`, async ({ request }) => {
    const body = (await request.json()) as ListPreferences;
    mockListPreferences = {
      showCompletedByDefault: body.showCompletedByDefault,
    };

    return HttpResponse.json(
      createApiResponse(
        mockListPreferences,
        "List preferences updated successfully",
      ),
    );
  }),

  // GET /lists - Hub summaries
  http.get(`${API_BASE}/lists`, () => {
    return HttpResponse.json(createApiResponse(mockLists.map(toListSummary)));
  }),

  // POST /lists - Create a family-owned list
  http.post(`${API_BASE}/lists`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      kind: ListKind;
    };
    const categories = categoriesForKind(body.kind);
    const newList: ListDetail = {
      id: createMockId(),
      name: body.name.trim(),
      kind: body.kind,
      categoryDisplayMode:
        body.kind === "general" || categories.length === 0 ? "flat" : "grouped",
      showCompletedOverride: null,
      categories,
      items: [],
      createdAt: MOCK_TIMESTAMP,
      updatedAt: MOCK_TIMESTAMP,
    };

    mockLists = [newList, ...mockLists];

    return HttpResponse.json(
      createApiResponse(newList, "List created successfully"),
      { status: 201 },
    );
  }),

  // ---------------------------------------------------------------------------
  // Category API handlers — must be BEFORE GET /lists/:id so that
  // /lists/categories is not captured by the :id wildcard.
  // ---------------------------------------------------------------------------

  // GET /lists/categories?kind={kind} - Management catalog for a kind
  http.get(`${API_BASE}/lists/categories`, ({ request }) => {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") as ListKind | null;
    if (!kind || !["grocery", "to-do", "general"].includes(kind)) {
      return HttpResponse.json(
        { message: "kind query parameter is required" },
        { status: 400 },
      );
    }
    return HttpResponse.json(createApiResponse(buildCatalog(kind)));
  }),

  // POST /lists/categories - Create a category
  http.post(`${API_BASE}/lists/categories`, async ({ request }) => {
    const body = (await request.json()) as CreateListCategoryRequest;
    const trimmed = body.name?.trim() ?? "";
    if (!trimmed) {
      return HttpResponse.json(
        { message: "Category name is required" },
        { status: 400 },
      );
    }
    if (trimmed.length > 100) {
      return HttpResponse.json(
        { message: "Category name must be 100 characters or less" },
        { status: 400 },
      );
    }
    const kind = body.kind;
    const catalog = mockCategoryCatalogs[kind];
    const normalized = normalizeForDuplicate(trimmed);
    if (catalog.some((c) => normalizeForDuplicate(c.name) === normalized)) {
      return HttpResponse.json(
        { message: "A category with this name already exists for this kind" },
        { status: 409 },
      );
    }
    const newOption: ListCategoryOption = {
      id: createMockCategoryId(),
      kind,
      name: trimmed,
      sortOrder: catalog.length,
    };
    mockCategoryCatalogs[kind] = [...catalog, newOption];

    const managementEntry: ListCategoryManagementEntry = {
      ...newOption,
      itemCount: 0,
    };

    const locationId = newOption.id;
    return HttpResponse.json(
      createApiResponse(managementEntry, "Category created successfully"),
      {
        status: 201,
        headers: { Location: `/api/lists/categories/${locationId}` },
      },
    );
  }),

  // PATCH /lists/categories/:categoryId - Rename a category
  http.patch(
    `${API_BASE}/lists/categories/:categoryId`,
    async ({ params, request }) => {
      const categoryId = params.categoryId as string;
      const body = (await request.json()) as RenameListCategoryRequest;
      const trimmed = body.name?.trim() ?? "";
      if (!trimmed) {
        return HttpResponse.json(
          { message: "Category name is required" },
          { status: 400 },
        );
      }
      if (trimmed.length > 100) {
        return HttpResponse.json(
          { message: "Category name must be 100 characters or less" },
          { status: 400 },
        );
      }

      // Find which kind this category belongs to
      let foundKind: ListKind | null = null;
      for (const kind of ["grocery", "to-do", "general"] as ListKind[]) {
        if (mockCategoryCatalogs[kind].some((c) => c.id === categoryId)) {
          foundKind = kind;
          break;
        }
      }
      if (!foundKind) {
        return HttpResponse.json(
          { message: `Category with id "${categoryId}" not found` },
          { status: 404 },
        );
      }

      const catalog = mockCategoryCatalogs[foundKind];
      const normalized = normalizeForDuplicate(trimmed);
      const duplicate = catalog.find(
        (c) =>
          c.id !== categoryId && normalizeForDuplicate(c.name) === normalized,
      );
      if (duplicate) {
        return HttpResponse.json(
          { message: "A category with this name already exists for this kind" },
          { status: 409 },
        );
      }

      let updated: ListCategoryOption | null = null;
      mockCategoryCatalogs[foundKind] = catalog.map((c) => {
        if (c.id !== categoryId) return c;
        updated = { ...c, name: trimmed };
        return updated;
      });

      if (!updated) {
        return HttpResponse.json(
          { message: `Category with id "${categoryId}" not found` },
          { status: 404 },
        );
      }

      const managementEntry: ListCategoryManagementEntry = {
        ...(updated as ListCategoryOption),
        itemCount: mockLists
          .filter((l) => l.kind === foundKind)
          .reduce(
            (sum, l) =>
              sum +
              l.items.filter((item) => item.categoryId === categoryId).length,
            0,
          ),
      };

      return HttpResponse.json(
        createApiResponse(managementEntry, "Category renamed successfully"),
      );
    },
  ),

  // DELETE /lists/categories/:categoryId - Delete a category
  http.delete(`${API_BASE}/lists/categories/:categoryId`, ({ params }) => {
    const categoryId = params.categoryId as string;

    // Find which kind
    let foundKind: ListKind | null = null;
    for (const kind of ["grocery", "to-do", "general"] as ListKind[]) {
      if (mockCategoryCatalogs[kind].some((c) => c.id === categoryId)) {
        foundKind = kind;
        break;
      }
    }
    if (!foundKind) {
      return HttpResponse.json(
        { message: `Category with id "${categoryId}" not found` },
        { status: 404 },
      );
    }

    // Count items affected
    const uncategorizedItemCount = mockLists
      .filter((l) => l.kind === foundKind)
      .reduce(
        (sum, l) =>
          sum + l.items.filter((item) => item.categoryId === categoryId).length,
        0,
      );

    // Remove from catalog and compact sortOrder
    mockCategoryCatalogs[foundKind] = mockCategoryCatalogs[foundKind]
      .filter((c) => c.id !== categoryId)
      .map((c, idx) => ({ ...c, sortOrder: idx }));

    const remainingCount = mockCategoryCatalogs[foundKind].length;

    // Null item assignments and flatten lists if catalog is now empty
    let flattenedListCount = 0;
    mockLists = mockLists.map((list) => {
      if (list.kind !== foundKind) return list;
      const updatedItems = list.items.map((item) =>
        item.categoryId === categoryId ? { ...item, categoryId: null } : item,
      );
      let categoryDisplayMode = list.categoryDisplayMode;
      if (remainingCount === 0 && categoryDisplayMode === "grouped") {
        categoryDisplayMode = "flat";
        flattenedListCount += 1;
      }

      return {
        ...list,
        categories: categoriesForKind(foundKind),
        items: updatedItems,
        categoryDisplayMode,
      };
    });

    const result: CategoryDeleteResult = {
      uncategorizedItemCount,
      flattenedListCount,
    };
    return HttpResponse.json(
      createApiResponse(result, "Category deleted successfully"),
    );
  }),

  // PUT /lists/categories/order - Reorder categories
  http.put(`${API_BASE}/lists/categories/order`, async ({ request }) => {
    const body = (await request.json()) as ReorderListCategoriesRequest;
    const kind = body.kind;
    const catalog = mockCategoryCatalogs[kind];

    // Validate expectedCategoryIds matches current catalog (stale baseline check)
    const currentIds = catalog.map((c) => c.id);
    if (
      currentIds.length !== body.expectedCategoryIds.length ||
      currentIds.some((id, i) => id !== body.expectedCategoryIds[i])
    ) {
      return HttpResponse.json(
        { message: "expectedCategoryIds does not match current catalog" },
        { status: 409 },
      );
    }

    // Validate categoryIds is a permutation of expectedCategoryIds
    const expectedSet = new Set(body.expectedCategoryIds);
    const categoryIdSet = new Set(body.categoryIds);
    if (
      body.categoryIds.length !== expectedSet.size ||
      categoryIdSet.size !== body.categoryIds.length ||
      [...categoryIdSet].some((id) => !expectedSet.has(id))
    ) {
      return HttpResponse.json(
        {
          message:
            "categoryIds must be a complete reorder of the current categories",
        },
        { status: 400 },
      );
    }

    // Build id → option map for reorder
    const optionMap = new Map(catalog.map((c) => [c.id, c]));
    mockCategoryCatalogs[kind] = body.categoryIds.map((id, idx) => ({
      ...(optionMap.get(id) as ListCategoryOption),
      sortOrder: idx,
    }));

    return HttpResponse.json(
      createApiResponse(
        buildCatalog(kind),
        "Categories reordered successfully",
      ),
    );
  }),

  // GET /lists/:id - Detail payload
  http.get(`${API_BASE}/lists/:id`, ({ params }) => {
    const list = mockLists.find((candidate) => candidate.id === params.id);
    if (!list) {
      return HttpResponse.json(
        { message: `List with id "${params.id}" not found` },
        { status: 404 },
      );
    }

    return HttpResponse.json(
      createApiResponse({
        ...list,
        categories: categoriesForKind(list.kind),
      }),
    );
  }),

  // PATCH /lists/:id - Update category display mode and completed override
  http.patch(`${API_BASE}/lists/:id`, async ({ params, request }) => {
    const index = mockLists.findIndex(
      (candidate) => candidate.id === params.id,
    );
    if (index === -1) {
      return HttpResponse.json(
        { message: `List with id "${params.id}" not found` },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      categoryDisplayMode: "grouped" | "flat";
      showCompletedOverride: boolean | null;
    };
    const existing = mockLists[index];

    if (
      body.categoryDisplayMode === "grouped" &&
      mockCategoryCatalogs[existing.kind].length === 0
    ) {
      return HttpResponse.json(
        { message: "Create a category first." },
        { status: 409 },
      );
    }

    const updated: ListDetail = {
      ...existing,
      categoryDisplayMode: body.categoryDisplayMode,
      showCompletedOverride: body.showCompletedOverride,
      categories: categoriesForKind(existing.kind),
      updatedAt: MOCK_TIMESTAMP,
    };

    mockLists = [
      ...mockLists.slice(0, index),
      updated,
      ...mockLists.slice(index + 1),
    ];

    return HttpResponse.json(
      createApiResponse(updated, "List updated successfully"),
    );
  }),

  // POST /lists/:id/items - Create an item
  http.post(`${API_BASE}/lists/:id/items`, async ({ params, request }) => {
    const index = mockLists.findIndex(
      (candidate) => candidate.id === params.id,
    );
    if (index === -1) {
      return HttpResponse.json(
        { message: `List with id "${params.id}" not found` },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      text: string;
      categoryId?: string | null;
    };
    const list = mockLists[index];
    const item: ListItem = {
      id: createMockId(),
      text: body.text.trim(),
      completed: false,
      completedAt: null,
      categoryId: body.categoryId ?? null,
      createdAt: MOCK_TIMESTAMP,
      updatedAt: MOCK_TIMESTAMP,
    };
    const updated: ListDetail = {
      ...list,
      items: [...list.items, item],
      updatedAt: MOCK_TIMESTAMP,
    };

    mockLists = [
      ...mockLists.slice(0, index),
      updated,
      ...mockLists.slice(index + 1),
    ];

    return HttpResponse.json(
      createApiResponse(item, "List item created successfully"),
      { status: 201 },
    );
  }),

  // POST /lists/:id/items/bulk - Append multiple items in one request
  http.post(`${API_BASE}/lists/:id/items/bulk`, async ({ params, request }) => {
    const index = mockLists.findIndex(
      (candidate) => candidate.id === params.id,
    );
    if (index === -1) {
      return HttpResponse.json(
        { message: `List with id "${params.id}" not found` },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      items: Array<{ text: string; categoryId?: string | null }>;
    };
    const list = mockLists[index];
    const createdItems: ListItem[] = body.items.map((row) => ({
      id: createMockId(),
      text: row.text.trim(),
      completed: false,
      completedAt: null,
      categoryId: row.categoryId ?? null,
      createdAt: MOCK_TIMESTAMP,
      updatedAt: MOCK_TIMESTAMP,
    }));
    const updated: ListDetail = {
      ...list,
      items: [...list.items, ...createdItems],
      updatedAt: MOCK_TIMESTAMP,
    };

    mockLists = [
      ...mockLists.slice(0, index),
      updated,
      ...mockLists.slice(index + 1),
    ];

    return HttpResponse.json(
      createApiResponse(createdItems, "List items added successfully"),
      { status: 201 },
    );
  }),

  // PATCH /lists/:listId/items/:itemId - Update text/category/completed state
  http.patch(
    `${API_BASE}/lists/:listId/items/:itemId`,
    async ({ params, request }) => {
      const listIndex = mockLists.findIndex(
        (candidate) => candidate.id === params.listId,
      );
      if (listIndex === -1) {
        return HttpResponse.json(
          { message: `List with id "${params.listId}" not found` },
          { status: 404 },
        );
      }

      const list = mockLists[listIndex];
      const itemIndex = list.items.findIndex(
        (candidate) => candidate.id === params.itemId,
      );
      if (itemIndex === -1) {
        return HttpResponse.json(
          { message: `List item with id "${params.itemId}" not found` },
          { status: 404 },
        );
      }

      const body = (await request.json()) as {
        text: string;
        completed: boolean;
        categoryId?: string | null;
      };
      const existing = list.items[itemIndex];
      const updatedItem: ListItem = {
        ...existing,
        text: body.text.trim(),
        completed: body.completed,
        completedAt: body.completed
          ? (existing.completedAt ?? MOCK_TIMESTAMP)
          : null,
        categoryId: body.categoryId ?? null,
        updatedAt: MOCK_TIMESTAMP,
      };
      const updatedList: ListDetail = {
        ...list,
        items: [
          ...list.items.slice(0, itemIndex),
          updatedItem,
          ...list.items.slice(itemIndex + 1),
        ],
        updatedAt: MOCK_TIMESTAMP,
      };

      mockLists = [
        ...mockLists.slice(0, listIndex),
        updatedList,
        ...mockLists.slice(listIndex + 1),
      ];

      return HttpResponse.json(
        createApiResponse(updatedItem, "List item updated successfully"),
      );
    },
  ),

  // DELETE /lists/:listId/items/:itemId - Delete an item
  http.delete(`${API_BASE}/lists/:listId/items/:itemId`, ({ params }) => {
    const listIndex = mockLists.findIndex(
      (candidate) => candidate.id === params.listId,
    );
    if (listIndex === -1) {
      return HttpResponse.json(
        { message: `List with id "${params.listId}" not found` },
        { status: 404 },
      );
    }

    const list = mockLists[listIndex];
    const updatedList: ListDetail = {
      ...list,
      items: list.items.filter((item) => item.id !== params.itemId),
      updatedAt: MOCK_TIMESTAMP,
    };

    mockLists = [
      ...mockLists.slice(0, listIndex),
      updatedList,
      ...mockLists.slice(listIndex + 1),
    ];

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /lists/:id/clear-completed - Remove completed items in bulk
  http.post(`${API_BASE}/lists/:id/clear-completed`, ({ params }) => {
    const index = mockLists.findIndex(
      (candidate) => candidate.id === params.id,
    );
    if (index === -1) {
      return HttpResponse.json(
        { message: `List with id "${params.id}" not found` },
        { status: 404 },
      );
    }

    const list = mockLists[index];
    const activeItems = list.items.filter((item) => !item.completed);
    const updated: ListDetail = {
      ...list,
      items: activeItems,
      updatedAt: MOCK_TIMESTAMP,
    };

    mockLists = [
      ...mockLists.slice(0, index),
      updated,
      ...mockLists.slice(index + 1),
    ];

    return HttpResponse.json(
      createApiResponse(
        { removedCount: list.items.length - activeItems.length },
        "Completed items removed successfully",
      ),
    );
  }),

  // ============================================================================
  // Calendar API Handlers
  // ============================================================================

  // GET /calendar/events - List events with optional filters
  http.get(`${API_BASE}/calendar/events`, ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const memberId = url.searchParams.get("memberId");

    let events = [...mockEvents];

    // Apply date range overlap filtering to match the real backend.
    // Multi-day all-day events should be returned when any part of the
    // event overlaps the requested range, not only when the start date
    // falls inside the range.
    if (startDate || endDate) {
      const rangeStart = startDate ? parseLocalDate(startDate) : null;
      const rangeEnd = endDate ? parseLocalDate(endDate) : null;

      events = events.filter((event) => {
        const eventStart = parseLocalDate(event.date);
        const eventEnd = event.endDate
          ? parseLocalDate(event.endDate)
          : eventStart;

        if (rangeStart && eventEnd < rangeStart) {
          return false;
        }

        if (rangeEnd && eventStart > rangeEnd) {
          return false;
        }

        return true;
      });
    }

    // Apply member filter
    if (memberId) {
      events = events.filter((e) => e.memberId === memberId);
    }

    return HttpResponse.json(createApiResponse(events));
  }),

  // GET /calendar/events/:id - Get single event
  http.get(`${API_BASE}/calendar/events/:id`, ({ params }) => {
    const { id } = params;
    const event = mockEvents.find((e) => e.id === id);

    if (!event) {
      return HttpResponse.json(
        { message: `Event with id "${id}" not found` },
        { status: 404 },
      );
    }

    return HttpResponse.json(createApiResponse(event));
  }),

  // POST /calendar/events - Create new event
  http.post(`${API_BASE}/calendar/events`, async ({ request }) => {
    const body = (await request.json()) as CreateEventRequest;

    const newEvent: CalendarEventResponse = {
      id: `event-${Date.now()}`,
      title: body.title,
      startTime: body.startTime,
      endTime: body.endTime,
      date: body.date,
      memberId: body.memberId,
      isAllDay: body.isAllDay,
      location: body.location,
    };

    mockEvents = [...mockEvents, newEvent];

    return HttpResponse.json(
      createApiResponse(newEvent, "Event created successfully"),
    );
  }),

  // PUT /calendar/events/:id - Update event (full replacement)
  http.put(`${API_BASE}/calendar/events/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as UpdateEventRequest;

    const index = mockEvents.findIndex((e) => e.id === id);
    if (index === -1) {
      return HttpResponse.json(
        { message: `Event with id "${id}" not found` },
        { status: 404 },
      );
    }

    const updatedEvent: CalendarEventResponse = {
      id: id as string,
      title: body.title,
      startTime: body.startTime,
      endTime: body.endTime,
      date: body.date,
      memberId: body.memberId,
      isAllDay: body.isAllDay,
      location: body.location,
    };

    mockEvents = [
      ...mockEvents.slice(0, index),
      updatedEvent,
      ...mockEvents.slice(index + 1),
    ];

    return HttpResponse.json(
      createApiResponse(updatedEvent, "Event updated successfully"),
    );
  }),

  // DELETE /calendar/events/:id - Delete event
  http.delete(`${API_BASE}/calendar/events/:id`, ({ params }) => {
    const { id } = params;

    const index = mockEvents.findIndex((e) => e.id === id);
    if (index === -1) {
      return HttpResponse.json(
        { message: `Event with id "${id}" not found` },
        { status: 404 },
      );
    }

    mockEvents = mockEvents.filter((e) => e.id !== id);

    return new HttpResponse(null, { status: 204 });
  }),

  // ============================================================================
  // Theme pack API Handlers
  // ============================================================================

  http.get(`${API_BASE}/theme-packs`, () => {
    return HttpResponse.json(
      createApiResponse(mockThemePacks.map(themePackSummary)),
    );
  }),

  http.post(`${API_BASE}/theme-packs`, async ({ request }) => {
    const body = (await request.json()) as ThemePackDocument;
    if (!body || body.version !== 1 || typeof body.name !== "string") {
      return HttpResponse.json(
        { message: "Theme pack version must be 1" },
        { status: 400 },
      );
    }
    if (
      mockThemePacks.some(
        (p) => p.document.name.toLowerCase() === body.name.toLowerCase(),
      )
    ) {
      return HttpResponse.json(
        { message: `A theme pack named "${body.name}" already exists` },
        { status: 409 },
      );
    }
    const pack: MockThemePack = {
      id: `pack-${mockThemePackIdCounter++}`,
      document: structuredClone(body),
      createdAt: new Date().toISOString(),
    };
    mockThemePacks.push(pack);
    return HttpResponse.json(
      createApiResponse(themePackSummary(pack), "Theme pack imported"),
      { status: 201 },
    );
  }),

  http.get(`${API_BASE}/theme-packs/:id`, ({ params }) => {
    const pack = mockThemePacks.find((p) => p.id === params.id);
    if (!pack) {
      return HttpResponse.json({ message: "Not found" }, { status: 404 });
    }
    return HttpResponse.json(pack.document);
  }),

  http.delete(`${API_BASE}/theme-packs/:id`, ({ params }) => {
    const index = mockThemePacks.findIndex((p) => p.id === params.id);
    if (index === -1) {
      return HttpResponse.json({ message: "Not found" }, { status: 404 });
    }
    mockThemePacks.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ============================================================================
  // Sports API Handlers
  // ============================================================================

  http.get(`${API_BASE}/sports/leagues`, () =>
    HttpResponse.json(createApiResponse(mockSports.leagues)),
  ),

  http.get(`${API_BASE}/sports/leagues/:league/teams`, ({ request }) => {
    const query = (new URL(request.url).searchParams.get("query") ?? "")
      .trim()
      .toLowerCase();
    return HttpResponse.json(
      createApiResponse(
        mockSports.teams.filter(
          (t) =>
            !query ||
            t.name.toLowerCase().includes(query) ||
            (t.shortName ?? "").toLowerCase().includes(query),
        ),
      ),
    );
  }),

  http.get(`${API_BASE}/sports/teams`, () =>
    HttpResponse.json(createApiResponse(mockSports.followed)),
  ),

  http.post(`${API_BASE}/sports/teams`, async ({ request }) => {
    const body = (await request.json()) as {
      league: SportsLeague;
      providerTeamId: string;
    };
    const team = mockSports.teams.find((t) => t.id === body.providerTeamId);
    if (!team) {
      return HttpResponse.json({ message: "No such team" }, { status: 404 });
    }
    const followed: FollowedTeam = {
      id: `followed-${team.id}`,
      league: body.league,
      providerTeamId: team.id,
      name: team.name,
      shortName: team.shortName,
      abbreviation: team.abbreviation,
      logoUrl: team.logoUrl,
      color: null,
      showOnCalendar: true,
      hideScores: false,
      memberIds: [],
    };
    mockSports.followed.push(followed);
    return HttpResponse.json(createApiResponse(followed, "Team followed"), {
      status: 201,
    });
  }),

  http.patch(`${API_BASE}/sports/teams/:id`, async ({ params, request }) => {
    const body = (await request.json()) as FollowedTeamUpdate;
    const team = mockSports.followed.find((t) => t.id === params.id);
    if (!team) {
      return HttpResponse.json({ message: "Not found" }, { status: 404 });
    }
    if (body.memberIds !== undefined) team.memberIds = body.memberIds;
    if (body.color !== undefined) team.color = body.color || null;
    if (body.showOnCalendar !== undefined) {
      team.showOnCalendar = body.showOnCalendar;
    }
    if (body.hideScores !== undefined) team.hideScores = body.hideScores;
    return HttpResponse.json(createApiResponse(team, "Team saved"));
  }),

  http.delete(`${API_BASE}/sports/teams/:id`, ({ params }) => {
    mockSports.followed = mockSports.followed.filter((t) => t.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE}/sports/games`, () =>
    HttpResponse.json(createApiResponse(mockSports.games)),
  ),

  http.get(`${API_BASE}/sports/live`, () =>
    HttpResponse.json(createApiResponse(mockSports.live)),
  ),

  http.get(`${API_BASE}/sports/games/:id/summary`, ({ params }) =>
    HttpResponse.json(
      createApiResponse({
        gameId: String(params.id),
        detail: null,
        lines: [],
        situation: [],
        leaders: [],
      }),
    ),
  ),

  // ============================================================================
  // Rewards API Handlers
  // ============================================================================

  http.get(`${API_BASE}/rewards`, () =>
    HttpResponse.json(createApiResponse(mockRewardShop)),
  ),

  http.post(`${API_BASE}/rewards/manage`, async ({ request }) => {
    const body = (await request.json()) as ParentPinRequest;
    if (body.pin !== MOCK_PARENT_PIN) return wrongPin();
    return HttpResponse.json(createApiResponse(mockRewardShop));
  }),

  http.post(`${API_BASE}/rewards/redemptions/decide`, async ({ request }) => {
    const body = (await request.json()) as RedemptionDecisionRequest;
    if (body.pin !== MOCK_PARENT_PIN) return wrongPin();
    const decided = [...(body.approve ?? []), ...(body.decline ?? [])];
    mockRewardShop.waiting = mockRewardShop.waiting.filter(
      (r) => !decided.includes(r.id),
    );
    return HttpResponse.json(
      createApiResponse({
        approved: body.approve?.length ?? 0,
        declined: body.decline?.length ?? 0,
      }),
    );
  }),

  http.post(`${API_BASE}/rewards/redemptions/:id/cancel`, ({ params }) => {
    mockRewardShop.waiting = mockRewardShop.waiting.filter(
      (r) => r.id !== params.id,
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE}/rewards`, async ({ request }) => {
    const body = (await request.json()) as RewardWriteRequest;
    if (body.pin !== MOCK_PARENT_PIN) return wrongPin();
    const reward = {
      id: `reward-${mockRewardIdCounter++}`,
      title: body.title,
      description: body.description ?? null,
      points: body.points,
    };
    mockRewardShop.rewards.push(reward);
    return HttpResponse.json(createApiResponse(reward, "Reward added"), {
      status: 201,
    });
  }),

  http.put(`${API_BASE}/rewards/:id`, async ({ params, request }) => {
    const body = (await request.json()) as RewardWriteRequest;
    if (body.pin !== MOCK_PARENT_PIN) return wrongPin();
    const reward = mockRewardShop.rewards.find((r) => r.id === params.id);
    if (!reward) {
      return HttpResponse.json({ message: "Not found" }, { status: 404 });
    }
    reward.title = body.title;
    reward.description = body.description ?? null;
    reward.points = body.points;
    return HttpResponse.json(createApiResponse(reward, "Reward saved"));
  }),

  http.post(`${API_BASE}/rewards/:id/archive`, async ({ params, request }) => {
    const body = (await request.json()) as ParentPinRequest;
    if (body.pin !== MOCK_PARENT_PIN) return wrongPin();
    mockRewardShop.rewards = mockRewardShop.rewards.filter(
      (r) => r.id !== params.id,
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    `${API_BASE}/rewards/:id/redemptions`,
    async ({ params, request }) => {
      const body = (await request.json()) as { memberId: string };
      const reward = mockRewardShop.rewards.find((r) => r.id === params.id);
      if (!reward) {
        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      }
      const member = mockFamily?.members.find((m) => m.id === body.memberId);
      const redemption = {
        id: `ask-${mockRewardIdCounter++}`,
        rewardId: reward.id,
        rewardTitle: reward.title,
        memberId: body.memberId,
        memberName: member?.name ?? "Someone",
        points: reward.points,
        status: "PENDING" as const,
        requestedAt: "2026-10-27T16:00:00Z",
      };
      mockRewardShop.waiting.push(redemption);
      return HttpResponse.json(
        createApiResponse(redemption, "Asked for the reward"),
        { status: 201 },
      );
    },
  ),

  // ============================================================================
  // Avatar Pack API Handlers
  // ============================================================================

  http.get(`${API_BASE}/avatar-packs`, () => {
    return HttpResponse.json(
      createApiResponse(mockAvatarPacks.map(avatarPackSummary)),
    );
  }),

  http.post(`${API_BASE}/avatar-packs`, async ({ request }) => {
    const body = (await request.json()) as AvatarPackDocument;
    if (
      !body ||
      body.version !== 1 ||
      typeof body.name !== "string" ||
      !Array.isArray(body.characters) ||
      body.characters.length === 0
    ) {
      return HttpResponse.json(
        { message: "Avatar pack needs at least one character" },
        { status: 400 },
      );
    }
    if (
      mockAvatarPacks.some(
        (p) => p.document.name.toLowerCase() === body.name.toLowerCase(),
      )
    ) {
      return HttpResponse.json(
        { message: `An avatar pack named "${body.name}" already exists` },
        { status: 409 },
      );
    }
    const pack: MockAvatarPack = {
      id: `avatars-${mockAvatarPackIdCounter++}`,
      document: structuredClone(body),
      createdAt: "2026-10-27T12:00:00Z",
    };
    mockAvatarPacks.push(pack);
    return HttpResponse.json(
      createApiResponse(avatarPackSummary(pack), "Avatar pack imported"),
      { status: 201 },
    );
  }),

  http.get(`${API_BASE}/avatar-packs/:id`, ({ params }) => {
    const pack = mockAvatarPacks.find((p) => p.id === params.id);
    if (!pack) {
      return HttpResponse.json({ message: "Not found" }, { status: 404 });
    }
    return HttpResponse.json(pack.document);
  }),

  http.delete(`${API_BASE}/avatar-packs/:id`, ({ params }) => {
    const index = mockAvatarPacks.findIndex((p) => p.id === params.id);
    if (index === -1) {
      return HttpResponse.json({ message: "Not found" }, { status: 404 });
    }
    mockAvatarPacks.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ============================================================================
  // Backup API Handlers
  // ============================================================================

  // GET /backup - the family's data as one document (unwrapped, it IS the file)
  http.get(`${API_BASE}/backup`, () => {
    return HttpResponse.json(mockBackupDocument);
  }),

  // POST /backup/restore - replace the family's data from a document
  http.post(`${API_BASE}/backup/restore`, async ({ request }) => {
    const body = (await request.json()) as BackupDocument;
    if (!body || body.version !== 1) {
      return HttpResponse.json(
        { message: "This file is not a Family Hub backup." },
        { status: 400 },
      );
    }
    return HttpResponse.json(
      createApiResponse(
        { members: 1, chores: 0, lists: 0, recipes: 0, meals: 0, events: 0 },
        "Backup restored",
      ),
    );
  }),

  // ============================================================================
  // Weather API Handlers
  // ============================================================================

  // GET /weather - 204 until a location is set, like the real API
  http.get(`${API_BASE}/weather`, () => {
    if (!mockWeather) {
      return new HttpResponse(null, { status: 204 });
    }
    return HttpResponse.json(createApiResponse(mockWeather));
  }),

  // ============================================================================
  // Chores API Handlers
  // ============================================================================

  // GET /chores/board - Present-focused recurring routines board
  http.get(`${API_BASE}/chores/board`, () => {
    return HttpResponse.json(createApiResponse(mockChoresBoard));
  }),

  // POST /chores/templates - Create recurring template
  http.post(`${API_BASE}/chores/templates`, async ({ request }) => {
    const body = (await request.json()) as CreateChoreTemplateRequest;
    const now = "2026-05-17T09:00:00Z";
    // One template per member, or a single unassigned one, like the real API.
    const assignees: Array<string | null> =
      body.assignedToMemberIds.length > 0 ? body.assignedToMemberIds : [null];
    const templates: ChoreTemplate[] = assignees.map((memberId, index) => ({
      id: `template-${mockIdCounter + 1 + index}`,
      title: body.title,
      assignedToMemberId: memberId,
      cadence: body.cadence,
      daysOfWeek: body.daysOfWeek ?? [],
      activeFrom: body.activeFrom,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }));

    return HttpResponse.json(
      createApiResponse(templates, "Chore template created successfully"),
      { status: 201 },
    );
  }),

  // PATCH /chores/templates/:id - Update or archive recurring template
  http.patch(
    `${API_BASE}/chores/templates/:id`,
    async ({ params, request }) => {
      const { id } = params;
      const body = (await request.json()) as UpdateChoreTemplateRequest;

      if (body.archived) {
        removeBoardItem(id as string);
      }

      const template: ChoreTemplate = {
        id: id as string,
        title: body.title ?? "Updated chore",
        assignedToMemberId: body.assignedToMemberId ?? "member-1",
        cadence: body.cadence ?? "DAILY",
        daysOfWeek: body.daysOfWeek ?? [],
        activeFrom: body.activeFrom ?? "2026-05-17",
        archived: body.archived ?? false,
        createdAt: "2026-05-17T08:00:00Z",
        updatedAt: "2026-05-17T09:00:00Z",
      };

      return HttpResponse.json(
        createApiResponse(template, "Chore template updated successfully"),
      );
    },
  ),

  // PUT /chores/templates/:id/current-period-completion
  http.put(
    `${API_BASE}/chores/templates/:id/current-period-completion`,
    async ({ params, request }) => {
      const { id } = params;
      const body =
        (await request.json()) as UpdateCurrentPeriodCompletionRequest;
      const scope =
        body.scope === "TODAY"
          ? mockChoresBoard.today
          : body.scope === "THIS_WEEK"
            ? mockChoresBoard.thisWeek
            : mockChoresBoard.thisMonth;
      const item = updateBoardItem(id as string, (existing) => ({
        ...existing,
        completed: true,
        completedAt: "2026-05-17T09:30:00Z",
        completedByMemberId:
          body.completedByMemberId ?? existing.assignedToMemberId ?? null,
      }));

      if (!item) {
        return HttpResponse.json(
          { message: `Chore template with id "${id}" not found` },
          { status: 404 },
        );
      }

      return HttpResponse.json(
        createApiResponse({
          scope: body.scope,
          periodStartDate: body.periodStartDate,
          periodEndDate: scope.periodEndDate,
          item,
        }),
      );
    },
  ),

  // DELETE /chores/templates/:id/current-period-completion
  http.delete(
    `${API_BASE}/chores/templates/:id/current-period-completion`,
    async ({ params, request }) => {
      const { id } = params;
      const body =
        (await request.json()) as UpdateCurrentPeriodCompletionRequest;
      const scope =
        body.scope === "TODAY"
          ? mockChoresBoard.today
          : body.scope === "THIS_WEEK"
            ? mockChoresBoard.thisWeek
            : mockChoresBoard.thisMonth;
      const item = updateBoardItem(id as string, (existing) => ({
        ...existing,
        completed: false,
        completedAt: null,
      }));

      if (!item) {
        return HttpResponse.json(
          { message: `Chore template with id "${id}" not found` },
          { status: 404 },
        );
      }

      return HttpResponse.json(
        createApiResponse({
          scope: body.scope,
          periodStartDate: body.periodStartDate,
          periodEndDate: scope.periodEndDate,
          item,
        }),
      );
    },
  ),

  // ============================================================================
  // Photos API Handlers
  // ============================================================================

  // ============================================================================
  // Family inbox API Handlers
  // ============================================================================

  http.get(`${API_BASE}/inbox`, () =>
    HttpResponse.json(createApiResponse(mockInbox)),
  ),

  http.post(
    `${API_BASE}/inbox/imports/:id/:decision`,
    async ({ params, request }) => {
      const body = (await request.json()) as ParentPinRequest;
      if (body.pin !== MOCK_PARENT_PIN) {
        return HttpResponse.json(
          { message: "That PIN is not right." },
          { status: 403 },
        );
      }
      const status =
        params.decision === "approve"
          ? "ADDED"
          : params.decision === "reject"
            ? "REJECTED"
            : "UNDONE";
      const decided = decideMockInboxImport(String(params.id), status);
      return decided
        ? HttpResponse.json(createApiResponse(decided))
        : HttpResponse.json({ message: "Not found" }, { status: 404 });
    },
  ),

  http.post(`${API_BASE}/inbox/senders`, async ({ request }) => {
    const body = (await request.json()) as InboxSenderRequest;
    if (body.pin !== MOCK_PARENT_PIN) {
      return HttpResponse.json(
        { message: "That PIN is not right." },
        { status: 403 },
      );
    }
    const sender = {
      id: `sender-${mockInbox.extraSenders.length + 1}`,
      address: body.address.trim().toLowerCase(),
    };
    seedMockInbox({ extraSenders: [...mockInbox.extraSenders, sender] });
    return HttpResponse.json(createApiResponse(sender));
  }),

  http.post(
    `${API_BASE}/inbox/senders/:id/remove`,
    async ({ params, request }) => {
      const body = (await request.json()) as ParentPinRequest;
      if (body.pin !== MOCK_PARENT_PIN) {
        return HttpResponse.json(
          { message: "That PIN is not right." },
          { status: 403 },
        );
      }
      seedMockInbox({
        extraSenders: mockInbox.extraSenders.filter(
          (sender) => sender.id !== params.id,
        ),
      });
      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.get(`${API_BASE}/photos/source`, () =>
    HttpResponse.json(createApiResponse(mockPhotoSource)),
  ),

  http.put(`${API_BASE}/photos/source`, async ({ request }) => {
    const body = (await request.json()) as PhotoSourceRequest;
    if (body.pin !== MOCK_PARENT_PIN) {
      return HttpResponse.json(
        { message: "Wrong PIN for Mom. 4 tries left." },
        { status: 403 },
      );
    }
    mockPhotoSource = body.folder
      ? { ...defaultPhotoSource(), folder: body.folder, indexing: true }
      : defaultPhotoSource();
    return HttpResponse.json(
      createApiResponse(mockPhotoSource, "Reading the folder"),
      { status: 202 },
    );
  }),

  http.get(`${API_BASE}/photos/folder/:id/content`, () => {
    return new HttpResponse(new Uint8Array([0xff, 0xd8, 0xff]), {
      headers: { "Content-Type": "image/jpeg" },
    });
  }),

  http.get(`${API_BASE}/photos/folder`, () =>
    HttpResponse.json(createApiResponse(mockFolderPhotoIds)),
  ),

  http.get(`${API_BASE}/photos/storage`, () =>
    HttpResponse.json(createApiResponse(mockPhotoStorage)),
  ),

  http.put(`${API_BASE}/photos/storage`, async ({ request }) => {
    const body = (await request.json()) as PhotoFolderRequest;
    if (body.pin !== MOCK_PARENT_PIN) {
      return HttpResponse.json(
        { message: "Wrong PIN for Mom. 4 tries left." },
        { status: 403 },
      );
    }
    if (!mockPhotoStorage.roots.some((root) => body.folder.startsWith(root))) {
      return HttpResponse.json(
        {
          message: `Photos can go in a folder under ${mockPhotoStorage.roots.join(" or ")}.`,
        },
        { status: 400 },
      );
    }
    // The mock finishes the move at once; the real server moves in the background.
    mockPhotoStorage = {
      ...mockPhotoStorage,
      folder: body.folder,
      moving: false,
      lastMove: {
        to: body.folder,
        moved: mockPhotos.length,
        error: null,
        finishedAt: "2026-10-27T18:00:00Z",
      },
    };
    return HttpResponse.json(
      createApiResponse(mockPhotoStorage, "Moving the photos"),
      {
        status: 202,
      },
    );
  }),

  http.get(`${API_BASE}/photos`, () => {
    return HttpResponse.json(createApiResponse(mockPhotos));
  }),

  http.post(`${API_BASE}/photos`, async ({ request }) => {
    const bytes = (await request.arrayBuffer()).byteLength;
    const photo: Photo = {
      id: `photo-${mockPhotos.length + 1}`,
      contentType: "image/jpeg",
      width: 1920,
      height: 1080,
      sizeBytes: bytes,
      createdAt: "2026-10-25T20:00:00Z",
    };
    mockPhotos = [photo, ...mockPhotos];
    return HttpResponse.json(createApiResponse(photo, "Photo added"), {
      status: 201,
    });
  }),

  http.delete(`${API_BASE}/photos/:id`, ({ params }) => {
    mockPhotos = mockPhotos.filter((p) => p.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE}/photos/:id/:variant`, () => {
    return new HttpResponse(new Uint8Array([0xff, 0xd8, 0xff]), {
      headers: { "Content-Type": "image/jpeg" },
    });
  }),

  // GET /chores/approvals/count - nothing waiting unless a test says otherwise
  http.get(`${API_BASE}/chores/approvals/count`, () => {
    return HttpResponse.json(createApiResponse({ count: 0 }));
  }),

  // POST /chores/approvals/pending - the list behind a parent's PIN
  http.post(`${API_BASE}/chores/approvals/pending`, () => {
    return HttpResponse.json(createApiResponse([]));
  }),

  // POST /chores/approvals - echoes how many were decided
  http.post(`${API_BASE}/chores/approvals`, async ({ request }) => {
    const body = (await request.json()) as {
      approve?: string[];
      reject?: string[];
    };
    return HttpResponse.json(
      createApiResponse({
        approved: body.approve?.length ?? 0,
        rejected: body.reject?.length ?? 0,
      }),
    );
  }),

  // GET /chores/points - no balances unless a test says otherwise
  http.get(`${API_BASE}/chores/points`, () => {
    return HttpResponse.json(createApiResponse([]));
  }),

  // POST /chores/activity - an empty log
  http.post(`${API_BASE}/chores/activity`, () => {
    return HttpResponse.json(createApiResponse([]));
  }),

  // ============================================================================
  // Family API Handlers
  // ============================================================================

  // GET /family - Get family data
  http.get(`${API_BASE}/family`, () => {
    return HttpResponse.json(createApiResponse(mockFamily));
  }),

  // PUT /family - Update family
  http.put(`${API_BASE}/family`, async ({ request }) => {
    if (!mockFamily) {
      return HttpResponse.json(
        { message: "No family exists" },
        { status: 404 },
      );
    }

    // Mirrors BE FamilyService (v1.6.0): fields left undefined are unchanged.
    const body = (await request.json()) as UpdateFamilyRequest;
    mockFamily = {
      ...mockFamily,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      // The real API geocodes; the mock just echoes a trimmed value or clears it.
      ...(body.weatherLocation !== undefined && {
        weatherLocation: body.weatherLocation.trim() || null,
      }),
    };

    return HttpResponse.json(
      createApiResponse(mockFamily, "Family updated successfully"),
    );
  }),

  // DELETE /family - Delete family
  http.delete(`${API_BASE}/family`, () => {
    mockFamily = null;
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /family/members - Add member
  http.post(`${API_BASE}/family/members`, async ({ request }) => {
    if (!mockFamily) {
      return HttpResponse.json(
        { message: "No family exists" },
        { status: 404 },
      );
    }

    const body = (await request.json()) as AddMemberRequest;
    const newMember: FamilyMember = {
      id: `member-${Date.now()}`,
      name: body.name,
      color: body.color,
      avatarUrl: body.avatarUrl,
      email: body.email,
    };

    mockFamily = {
      ...mockFamily,
      members: [...mockFamily.members, newMember],
    };

    return HttpResponse.json(
      createApiResponse(newMember, "Member added successfully"),
    );
  }),

  // PUT /family/members/:id/role - the real API also checks the family password
  http.put(
    `${API_BASE}/family/members/:id/role`,
    async ({ params, request }) => {
      const body = (await request.json()) as { role: "PARENT" | "KID" };
      const member = mockFamily?.members.find((m) => m.id === params.id);
      if (!mockFamily || !member) {
        return HttpResponse.json(
          { message: "Family member not found" },
          { status: 404 },
        );
      }
      const updated: FamilyMember = {
        ...member,
        role: body.role,
        hasPin: body.role === "KID" ? false : member.hasPin,
      };
      mockFamily = {
        ...mockFamily,
        members: mockFamily.members.map((m) =>
          m.id === member.id ? updated : m,
        ),
      };
      return HttpResponse.json(createApiResponse(updated, "Role updated"));
    },
  ),

  // PUT /family/members/:id/pin - 204, like the real API
  http.put(`${API_BASE}/family/members/:id/pin`, ({ params }) => {
    if (mockFamily) {
      mockFamily = {
        ...mockFamily,
        members: mockFamily.members.map((m) =>
          m.id === params.id ? { ...m, hasPin: true } : m,
        ),
      };
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // PUT /family/members/:id - Update member
  http.put(`${API_BASE}/family/members/:id`, async ({ params, request }) => {
    if (!mockFamily) {
      return HttpResponse.json(
        { message: "No family exists" },
        { status: 404 },
      );
    }

    const { id } = params;
    const body = (await request.json()) as UpdateMemberRequest;

    const index = mockFamily.members.findIndex((m) => m.id === id);
    if (index === -1) {
      return HttpResponse.json(
        { message: `Member with id "${id}" not found` },
        { status: 404 },
      );
    }

    const existingMember = mockFamily.members[index];
    const updatedMember: FamilyMember = {
      ...existingMember,
      name: body.name,
      color: body.color,
      avatarUrl:
        body.avatarUrl !== undefined
          ? body.avatarUrl
          : existingMember.avatarUrl,
      email: body.email !== undefined ? body.email : existingMember.email,
    };

    mockFamily = {
      ...mockFamily,
      members: [
        ...mockFamily.members.slice(0, index),
        updatedMember,
        ...mockFamily.members.slice(index + 1),
      ],
    };

    return HttpResponse.json(
      createApiResponse(updatedMember, "Member updated successfully"),
    );
  }),

  // DELETE /family/members/:id - Remove member
  http.delete(`${API_BASE}/family/members/:id`, ({ params }) => {
    if (!mockFamily) {
      return HttpResponse.json(
        { message: "No family exists" },
        { status: 404 },
      );
    }

    const { id } = params;
    const index = mockFamily.members.findIndex((m) => m.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { message: `Member with id "${id}" not found` },
        { status: 404 },
      );
    }

    mockFamily = {
      ...mockFamily,
      members: mockFamily.members.filter((m) => m.id !== id),
    };

    return new HttpResponse(null, { status: 204 });
  }),

  // ============================================================================
  // Auth API Handlers
  // ============================================================================

  // POST /auth/login - Login
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as LoginRequest;
    const normalizedUsername = body.username.toLowerCase().trim();

    const user = mockUsers.find((u) => u.username === normalizedUsername);
    if (!user || user.password !== body.password) {
      return HttpResponse.json(
        { message: "Invalid username or password" },
        { status: 401 },
      );
    }

    if (!mockFamily || mockFamily.id !== user.familyId) {
      return HttpResponse.json(
        { message: "Family data not found" },
        { status: 404 },
      );
    }

    const response: LoginResponse = {
      data: {
        token: `mock-token-${normalizedUsername}`,
        family: mockFamily,
      },
      message: "Login successful",
    };

    return HttpResponse.json(response);
  }),

  // POST /auth/register - Register
  http.post(`${API_BASE}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as RegisterRequest;
    const normalizedUsername = body.username.toLowerCase().trim();

    // Check if username exists
    if (mockUsers.some((u) => u.username === normalizedUsername)) {
      return HttpResponse.json(
        { message: "Username already taken", field: "username" },
        { status: 409 },
      );
    }

    // Create family
    mockFamily = {
      id: `family-${Date.now()}`,
      name: body.familyName,
      members: body.members.map((m) => ({
        ...m,
        id: `member-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })),
      createdAt: new Date().toISOString(),
    };

    // Create user
    mockUsers.push({
      username: normalizedUsername,
      password: body.password,
      familyId: mockFamily.id,
    });

    const response: RegisterResponse = {
      data: {
        token: `mock-token-${normalizedUsername}`,
        family: mockFamily,
      },
      message: "Registration successful",
    };

    return HttpResponse.json(response);
  }),

  // PUT /auth/password - Change the sign-in password (signed in)
  http.put(`${API_BASE}/auth/password`, async ({ request }) => {
    const body = (await request.json()) as ChangePasswordRequest;
    const user = mockFamily
      ? mockUsers.find((u) => u.familyId === mockFamily?.id)
      : undefined;
    if (!user || !mockFamily) {
      return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (user.password !== body.currentPassword) {
      return HttpResponse.json(
        { message: "That isn't the password this family signs in with." },
        { status: 403 },
      );
    }
    user.password = body.newPassword;
    const response: ChangePasswordResponse = {
      data: { token: `mock-token-${user.username}-new`, family: mockFamily },
      message: "Password changed",
    };
    return HttpResponse.json(response);
  }),

  // GET /auth/check-username - Check username availability
  http.get(`${API_BASE}/auth/check-username`, ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get("username")?.toLowerCase().trim();

    const available = !mockUsers.some((u) => u.username === username);
    const response: UsernameCheckResponse = { data: { available } };

    return HttpResponse.json(response);
  }),

  // ============================================================================
  // Google Calendar API Handlers (default: disconnected state)
  // ============================================================================

  // GET /google/status/:memberId - Connection status (default: disconnected)
  http.get(`${API_BASE}/google/status/:memberId`, () => {
    return HttpResponse.json(
      createApiResponse({ connected: false, calendars: [] }),
    );
  }),

  // GET /google/calendars/:memberId - Calendar list (default: empty)
  http.get(`${API_BASE}/google/calendars/:memberId`, () => {
    return HttpResponse.json(createApiResponse([]));
  }),
];
