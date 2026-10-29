import { Check } from "lucide-react";
import { useId, useState } from "react";
import { isCustomColor, memberColor, readableTextOn } from "@/lib/member-color";
import { colorMap, type FamilyColor, familyColors } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CustomColorChooser } from "./custom-color-chooser";

/** A colour wheel's look for the custom swatch: the hues around, white at the middle. */
const WHEEL =
  "radial-gradient(circle, #ffffff 0%, rgb(255 255 255 / 0) 70%), conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";

interface ColorPickerProps {
  value?: FamilyColor;
  onChange: (color: FamilyColor) => void;
  usedColors?: FamilyColor[];
  error?: string;
  /** ID for the error message element, used for aria-describedby */
  errorId?: string;
}

/**
 * The seven named colours (one per member: those taken by others are greyed),
 * plus a colour-wheel swatch that opens a chooser for any colour. A custom
 * colour is never "taken": there are enough to go round.
 */
export function ColorPicker({
  value,
  onChange,
  usedColors = [],
  error,
  errorId = "color-picker-error",
}: ColorPickerProps) {
  const [choosing, setChoosing] = useState(false);
  const chooserId = useId();
  const custom = value !== undefined && isCustomColor(value) ? value : null;

  return (
    <fieldset className="space-y-2 border-0 p-0 m-0">
      <legend className="sr-only">Select a color</legend>
      <div
        aria-describedby={error ? errorId : undefined}
        className="flex flex-wrap gap-3 justify-center"
      >
        {familyColors.map((color) => {
          const colors = colorMap[color];
          const isSelected = value === color;
          const isUsed = usedColors.includes(color) && !isSelected;

          return (
            <button
              key={color}
              type="button"
              onClick={() => {
                setChoosing(false);
                onChange(color);
              }}
              disabled={isUsed}
              aria-pressed={isSelected}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                colors.bg,
                isSelected && "ring-2 ring-offset-2 ring-foreground",
                isUsed && "opacity-30 cursor-not-allowed",
                !isSelected && !isUsed && "hover:scale-110",
              )}
              aria-label={`Select ${color} color`}
            >
              {isSelected && <Check className="h-5 w-5 text-white" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setChoosing((open) => !open)}
          aria-label="Choose a custom color"
          aria-pressed={custom !== null}
          aria-expanded={choosing}
          aria-controls={choosing ? chooserId : undefined}
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center transition-all",
            custom ? "ring-2 ring-offset-2 ring-foreground" : "hover:scale-110",
          )}
          style={{ backgroundImage: WHEEL }}
        >
          {custom && (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white"
              style={{ backgroundColor: custom, color: readableTextOn(custom) }}
            >
              <Check className="h-4 w-4" />
            </span>
          )}
        </button>
      </div>
      {choosing && (
        <CustomColorChooser
          id={chooserId}
          initial={memberColor(value ?? "coral").hex}
          onChange={onChange}
        />
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive text-center">
          {error}
        </p>
      )}
    </fieldset>
  );
}
