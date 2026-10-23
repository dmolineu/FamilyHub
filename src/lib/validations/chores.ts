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
  })
  .transform((data) =>
    data.cadence === "WEEKLY" ? data : { ...data, daysOfWeek: [] },
  );

export type ChoreFormInput = z.input<typeof choreFormSchema>;
export type ChoreFormData = z.output<typeof choreFormSchema>;
