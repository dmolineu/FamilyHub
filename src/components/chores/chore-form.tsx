import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useFamilyMembers } from "@/api";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberMultiSelect } from "@/components/ui/member-multi-select";
import type { ChoreCadence } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  type ChoreFormData,
  type ChoreFormInput,
  choreFormSchema,
} from "@/lib/validations";

interface ChoreFormProps {
  defaultValues?: Partial<ChoreFormInput>;
  onSubmit: (data: ChoreFormData) => void;
  onCancel: () => void;
  isPending?: boolean;
  hideCancelButton?: boolean;
}

export function ChoreForm({
  defaultValues,
  onSubmit,
  onCancel,
  isPending = false,
  hideCancelButton = false,
}: ChoreFormProps) {
  const familyMembers = useFamilyMembers();
  const defaultTitle = defaultValues?.title;
  // Keyed on content, not array identity: a parent re-rendering with an
  // equivalent defaults literal must not reset what the user has typed.
  const defaultAssigneeKey = defaultValues?.assignedToMemberIds?.join("|");
  const defaultCadence = defaultValues?.cadence;
  const titleRef = useRef<HTMLInputElement | null>(null);

  const initialValues = useMemo(
    (): Partial<ChoreFormInput> => ({
      title: defaultTitle ?? "",
      // Nobody preselected: the chore is for anyone until members are tapped.
      assignedToMemberIds: defaultAssigneeKey
        ? defaultAssigneeKey.split("|")
        : [],
      cadence: defaultCadence ?? "DAILY",
    }),
    [defaultTitle, defaultAssigneeKey, defaultCadence],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChoreFormInput, undefined, ChoreFormData>({
    resolver: zodResolver(choreFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  // The form opens from a "+" button; focusing the name lets typing start at once.
  // Done here rather than with autoFocus so the containing sheet, which only
  // focuses itself when no child holds focus, leaves it alone.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const assignedToMemberIds = watch("assignedToMemberIds") ?? [];
  const cadence = watch("cadence") ?? "DAILY";

  const { ref: titleRegisterRef, ...titleRegister } = register("title");

  const handleFormSubmit = (data: ChoreFormData) => {
    if (isPending) return;
    onSubmit(data);
  };

  const cadenceOptions: Array<{ value: ChoreCadence; label: string }> = [
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "MONTHLY", label: "Monthly" },
  ];

  return (
    <form
      id="chore-form"
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="chore-title">Chore Name</Label>
        <Input
          id="chore-title"
          {...titleRegister}
          ref={(element) => {
            titleRegisterRef(element);
            titleRef.current = element;
          }}
          placeholder="What needs doing?"
          className={cn("bg-input", errors.title && "border-destructive")}
          aria-invalid={!!errors.title}
        />
        <FormError message={errors.title?.message} />
      </div>

      <div className="space-y-2">
        <Label>Assign To</Label>
        <MemberMultiSelect
          members={familyMembers}
          value={assignedToMemberIds}
          onChange={(memberIds) =>
            setValue("assignedToMemberIds", memberIds, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Pick several to give each person their own copy, or leave it for
          anyone.
        </p>
        <FormError message={errors.assignedToMemberIds?.message} />
      </div>

      <div className="space-y-2">
        <Label>Repeats</Label>
        <div className="grid grid-cols-3 gap-2">
          {cadenceOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={cadence === option.value ? "default" : "outline"}
              aria-pressed={cadence === option.value}
              onClick={() =>
                setValue("cadence", option.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className="min-w-0"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <FormError message={errors.cadence?.message} />
      </div>

      <div className="flex gap-3 pt-3">
        {!hideCancelButton && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 bg-transparent"
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 bg-primary hover:bg-primary/90"
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save Chore"}
        </Button>
      </div>
    </form>
  );
}

export type { ChoreFormProps };
