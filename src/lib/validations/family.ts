import { z } from "zod";

// BE DTO alignment:
//   FamilyRequest.java      — name: @Size(max=50), timezone: optional IANA zone id
//                             (validated server-side via ZoneId.of; invalid → 400)
//   FamilyMemberRequest.java — name: @Size(max=30), email: @Size(max=254) @Email,
//                              color: @NotBlank, avatarUrl: MemberAvatars (≤ 64 KB picture)

/**
 * Schema for family name validation.
 * Used in onboarding step 2 and family settings.
 */
export const familyNameSchema = z.object({
  name: z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(1, "Family name is required")
        .max(50, "Family name must be 50 characters or less"),
    ),
});

export type FamilyNameFormData = z.infer<typeof familyNameSchema>;

/**
 * Valid family colors. The message lives here rather than at the call sites: a
 * missing or invalid color fails this base schema first, so a wrapping
 * `.refine()` never runs and Zod's raw enum text would reach the UI. Both member
 * surfaces inherit this message.
 */
const familyColorSchema = z.enum(
  ["coral", "teal", "green", "purple", "yellow", "pink", "orange"],
  { message: "Please select a color" },
);

/**
 * Schema for family member form validation.
 * Used when adding or editing a family member.
 */
export const memberFormSchema = z.object({
  name: z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(1, "Name is required")
        .max(30, "Name must be 30 characters or less"),
    ),
  color: familyColorSchema,
});

export type MemberFormData = z.infer<typeof memberFormSchema>;

/**
 * Creates a member form schema with duplicate name validation.
 * @param existingNames - Array of existing member names to check against
 * @param currentName - Current member name (for edit mode, to exclude self)
 */
export const createMemberFormSchema = (
  existingNames: string[],
  currentName?: string,
) => {
  const lowerNames = existingNames
    .filter((n) => n.toLowerCase() !== currentName?.toLowerCase())
    .map((n) => n.toLowerCase());

  return z.object({
    name: z
      .string()
      .transform((val) => val.trim())
      .pipe(
        z
          .string()
          .min(1, "Name is required")
          .max(30, "Name must be 30 characters or less")
          .refine((val) => !lowerNames.includes(val.toLowerCase()), {
            message: "A member with this name already exists",
          }),
      ),
    color: familyColorSchema,
  });
};

/**
 * Creates a member profile schema with duplicate name and email validation.
 * Used in MemberProfileModal for editing member profiles.
 * @param existingNames - Array of existing member names to check against
 * @param currentName - Current member name (for edit mode, to exclude self)
 */
export const createMemberProfileSchema = (
  existingNames: string[],
  currentName?: string,
) => {
  const lowerNames = existingNames
    .filter((n) => n.toLowerCase() !== currentName?.toLowerCase())
    .map((n) => n.toLowerCase());

  return z
    .object({
      name: z
        .string()
        .transform((val) => val.trim())
        .pipe(
          z
            .string()
            .min(1, "Name is required")
            .max(30, "Name must be 30 characters or less")
            .refine((val) => !lowerNames.includes(val.toLowerCase()), {
              message: "A member with this name already exists",
            }),
        ),
      color: familyColorSchema,
      email: z
        .string()
        .max(254, "Email must be 254 characters or less")
        .transform((val) => val.trim())
        .refine(
          (val) => val === "" || z.string().email().safeParse(val).success,
          { message: "Please enter a valid email" },
        ),
      // Birthday as form strings ("" = not set); the year is optional.
      birthMonth: z.string(),
      birthDay: z.string(),
      birthYear: z.string().transform((val) => val.trim()),
    })
    .superRefine((data, ctx) => {
      for (const issue of birthdayIssues(data, new Date())) {
        ctx.addIssue({
          code: "custom",
          path: [issue.field],
          message: issue.message,
        });
      }
    });
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The same rules the server applies (FamilyMemberRequest.birthday): month and day
 * together, a real date, 29 February only without a year or in a leap year, and
 * a year from 1900 that is not in the future.
 */
export function birthdayIssues(
  data: { birthMonth: string; birthDay: string; birthYear: string },
  now: Date,
): { field: "birthMonth" | "birthDay" | "birthYear"; message: string }[] {
  const { birthMonth, birthDay, birthYear } = data;
  if (birthMonth === "" && birthDay === "") {
    return birthYear === ""
      ? []
      : [{ field: "birthMonth", message: "Choose the month and day too" }];
  }
  if (birthMonth === "" || birthDay === "") {
    return [
      {
        field: birthMonth === "" ? "birthMonth" : "birthDay",
        message: "Choose both a month and a day",
      },
    ];
  }
  const month = Number(birthMonth);
  const day = Number(birthDay);
  if (day > daysInMonth(month, 2000)) {
    return [
      {
        field: "birthDay",
        message: `${MONTH_NAMES[month - 1]} has only ${daysInMonth(month, 2000)} days`,
      },
    ];
  }
  if (birthYear === "") return [];
  if (!/^\d{4}$/.test(birthYear)) {
    return [
      {
        field: "birthYear",
        message: "Enter a four-digit year, or leave it blank",
      },
    ];
  }
  const year = Number(birthYear);
  if (year < 1900) {
    return [
      { field: "birthYear", message: "A birth year must be 1900 or later" },
    ];
  }
  if (day > daysInMonth(month, year)) {
    return [
      {
        field: "birthYear",
        message: `${MONTH_NAMES[month - 1]} ${day} does not exist in ${year}`,
      },
    ];
  }
  if (new Date(year, month - 1, day) > now) {
    return [
      { field: "birthYear", message: "A birthday cannot be in the future" },
    ];
  }
  return [];
}

export type MemberProfileFormData = z.infer<
  ReturnType<typeof createMemberProfileSchema>
>;

/**
 * Schema for validating a single family member from localStorage.
 */
export const familyMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(30),
  color: familyColorSchema,
  // The backend returns null (not absent) for an unset avatar/email. Accept it
  // and normalize to undefined so seeded/cached family data validates offline.
  // A built-in key, an https link or a picture data URL of up to 64 KB (about 88k
  // base64 characters); the server checks the exact rules.
  avatarUrl: z
    .string()
    .max(100_000)
    .nullish()
    .transform((val) => val ?? undefined),
  email: z
    .string()
    .max(254)
    .email()
    .or(z.literal(""))
    .nullish()
    .transform((val) => val ?? undefined),
  // Anything the API sends about a member has to be listed here, or the copy in
  // localStorage silently loses it. `.catch` drops an unreadable value instead
  // of failing the whole cached family.
  birthday: z
    .object({
      month: z.number().int(),
      day: z.number().int(),
      year: z.number().int().nullish(),
    })
    .nullish()
    .catch(null),
  role: z.enum(["PARENT", "KID"]).optional().catch(undefined),
  hasPin: z.boolean().optional().catch(undefined),
});

/**
 * Schema for validating FamilyData from localStorage.
 * Used during rehydration to ensure data integrity.
 */
export const familyDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  // Optional: pre-1.6.0 BE localStorage caches lack timezone.
  timezone: z.string().min(1).optional(),
  weatherLocation: z.string().nullish(),
  members: z.array(familyMemberSchema),
  createdAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
});

export type ValidatedFamilyData = z.infer<typeof familyDataSchema>;

/**
 * Validates family data from localStorage.
 * Returns null if validation fails.
 */
export function validateFamilyData(data: unknown): ValidatedFamilyData | null {
  const result = familyDataSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn("Family data validation failed:", result.error.issues);
  return null;
}
