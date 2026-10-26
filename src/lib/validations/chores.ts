import { z } from "zod";

const dayOfWeekSchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const POINTS_MESSAGE = "Give this chore 1 to 100 points";

export const choreFormSchema = z
  .object({
    title: z
      .string()
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, "Chore name is required")
          .max(100, "Chore name must be 100 characters or less"),
      ),
    // Empty means the chore is for anyone; whoever completes it gets the credit.
    assignedToMemberIds: z.array(z.string().min(1)).default([]),
    cadence: z.enum(["DAILY", "WEEKLY", "MONTHLY"], {
      message: "Cadence is required",
    }),
    // Only weekly chores can be pinned to days; anything else sends none.
    daysOfWeek: z.array(dayOfWeekSchema).default([]),
    // Required, with no default: a parent decides what each chore is worth.
    points: z.coerce
      .number({ message: POINTS_MESSAGE })
      .int(POINTS_MESSAGE)
      .min(1, POINTS_MESSAGE)
      .max(100, POINTS_MESSAGE),
  })
  .transform((data) =>
    data.cadence === "WEEKLY" ? data : { ...data, daysOfWeek: [] },
  );

export type ChoreFormInput = z.input<typeof choreFormSchema>;
export type ChoreFormData = z.output<typeof choreFormSchema>;
