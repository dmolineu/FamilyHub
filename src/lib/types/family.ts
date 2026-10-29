/**
 * The seven named colours a member can take.
 */
export type PaletteColor =
  | "coral"
  | "teal"
  | "green"
  | "purple"
  | "yellow"
  | "pink"
  | "orange";

/** A colour the family picked themselves, as lowercase `#rrggbb`. */
export type CustomColor = `#${string}`;

/**
 * A member's colour: one of the named colours, or a custom `#rrggbb` (some
 * characters' pictures look wrong on every named colour). Look one up with
 * `memberColor()` from `@/lib/member-color`, which understands both.
 */
export type FamilyColor = PaletteColor | CustomColor;

/** Month and day, the year optional (a parent may keep their age private). */
export interface MemberBirthday {
  month: number;
  day: number;
  year?: number | null;
}

/** Parents approve kids' chores with their own PIN; everyone starts as a parent. */
export type MemberRole = "PARENT" | "KID";

/**
 * A family member with name, color, and optional avatar.
 */
export interface FamilyMember {
  id: string;
  name: string;
  color: FamilyColor;
  avatarUrl?: string;
  email?: string;
  birthday?: MemberBirthday | null;
  /** Absent in caches from before roles existed: treat as a parent. */
  role?: MemberRole;
  /** True for a parent who has set their own PIN. */
  hasPin?: boolean;
  /**
   * The look a screen switches to when this member is tapped: `builtin:<id>` or
   * `pack:<pack name>`. Null or absent: the screen keeps its own look.
   */
  theme?: string | null;
}

/**
 * Family data stored in localStorage.
 *
 * BE DTO: FamilyResponse.java (v1.6.0) — id, name, timezone, members, createdAt.
 * `timezone` is always present in API responses (server resolves a default),
 * but optional here because pre-1.6.0 localStorage caches lack it.
 */
export interface FamilyData {
  id: string;
  name: string;
  timezone?: string;
  /** Geocoded display name for the Home weather; null until set in Settings. */
  weatherLocation?: string | null;
  /** Resolved from the weather location; absent or null until one is set. */
  latitude?: number | null;
  longitude?: number | null;
  /**
   * Minutes a screen showing someone's own theme may go untouched before it goes
   * back to its own look; 0 or absent means never. One value for every screen.
   */
  themeRevertMinutes?: number;
  members: FamilyMember[];
  createdAt: string;
}

/**
 * Get a family member by ID from an array.
 * @param members - The array of family members
 * @param id - The family member ID
 * @returns The family member or undefined if not found
 */
export function getFamilyMember(
  members: FamilyMember[],
  id: string,
): FamilyMember | undefined {
  return members.find((m) => m.id === id);
}

/** The classes and hex a member's colour is drawn with. */
export interface MemberColorStyle {
  bg: string;
  text: string;
  light: string;
  hex: string;
}

/**
 * Color map for the named colours: bg, text, and light variants. A custom
 * colour has none here; `memberColor()` makes its classes.
 */
export const colorMap: Record<PaletteColor, MemberColorStyle> = {
  coral: {
    bg: "bg-[#b95443]",
    text: "text-[#8b3d32]",
    light: "bg-[#fbe9e6]",
    hex: "#b95443",
  },
  teal: {
    bg: "bg-[#2f827f]",
    text: "text-[#2d6360]",
    light: "bg-[#e0f4f3]",
    hex: "#2f827f",
  },
  pink: {
    bg: "bg-[#aa4d77]",
    text: "text-[#8b4660]",
    light: "bg-[#fce8f0]",
    hex: "#aa4d77",
  },
  green: {
    bg: "bg-[#467c4b]",
    text: "text-[#3d6b3d]",
    light: "bg-[#e6f5e6]",
    hex: "#467c4b",
  },
  purple: {
    bg: "bg-[#7052ad]",
    text: "text-[#523d70]",
    light: "bg-[#ede6f7]",
    hex: "#7052ad",
  },
  yellow: {
    bg: "bg-[#8f6a16]",
    text: "text-[#7a5f10]",
    light: "bg-[#fef6dc]",
    hex: "#8f6a16",
  },
  orange: {
    bg: "bg-[#ad6429]",
    text: "text-[#7a4f10]",
    light: "bg-[#fef0dc]",
    hex: "#ad6429",
  },
};

/**
 * The named colours, in the order the colour picker shows them.
 */
export const familyColors: PaletteColor[] = [
  "coral",
  "teal",
  "green",
  "purple",
  "yellow",
  "pink",
  "orange",
];

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to update family properties. Fields left undefined are unchanged.
 *
 * BE DTO: FamilyRequest.java (v1.6.0) — name: @Size(1..50), timezone: IANA zone
 * id validated server-side (invalid → 400 "Timezone must be a valid IANA
 * timezone."). FamilyRequest also carries `username`, which the FE never updates.
 */
export interface UpdateFamilyRequest {
  name?: string;
  timezone?: string;
  /** City, "city, state" or postal code; "" clears it. */
  weatherLocation?: string;
  /** 0 (never), 5, 15 or 60. */
  themeRevertMinutes?: number;
}

/**
 * Request to add a new member to the family.
 */
export interface AddMemberRequest {
  name: string;
  color: FamilyColor;
  avatarUrl?: string;
  email?: string;
  birthday?: MemberBirthday | null;
}

/**
 * Request to update an existing member.
 */
export interface UpdateMemberRequest {
  name: string;
  color: FamilyColor;
  avatarUrl?: string | null;
  email?: string;
  /** Omitting it clears the birthday on the server: always pass the current one. */
  birthday?: MemberBirthday | null;
}

/** Makes a member a parent or a kid; the family password guards it. */
/** A member's own look: `builtin:<id>`, `pack:<pack name>`, or null for the screen's own. */
export interface SetMemberThemeRequest {
  theme: string | null;
}

export interface SetMemberRoleRequest {
  role: MemberRole;
  password: string;
}

/** Sets a parent's own 4-digit PIN; the family password guards it. */
export interface SetMemberPinRequest {
  password: string;
  pin: string;
}

// Re-export unified response type
export type { ApiResponse } from "./api-response";

// Type aliases using unified ApiResponse
import type { ApiResponse } from "./api-response";

/**
 * API response wrapper for family data.
 * Returns null when no family exists (triggers onboarding).
 */
export type FamilyApiResponse = ApiResponse<FamilyData | null>;

/**
 * Mutation response for family operations.
 */
export type FamilyMutationResponse = ApiResponse<FamilyData>;

/**
 * Mutation response for member operations.
 */
export type MemberMutationResponse = ApiResponse<FamilyMember>;
