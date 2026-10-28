/** The event card layouts an hour grid chooses between. */
export type GridEventCardVariant = "default" | "compact" | "slim";

/**
 * Height each card needs, in rem, before its text is cut through: the full card's
 * padding, title and time row; the narrow card's padding and first title line.
 */
const NEEDED_REM: Record<"default" | "compact", number> = {
  default: 3,
  compact: 1.75,
};

/**
 * The card an event of `heightPx` should use. A card too short for its text drops to
 * the one-line slim card, so a half-hour event on a wall still shows its title instead
 * of the top half of it. Measured in rem because the wall's text grows with the screen
 * while the hour rows are fitted in pixels.
 */
export function fitEventCardVariant(
  variant: "default" | "compact",
  heightPx: number,
  remPx: number,
): GridEventCardVariant {
  return heightPx < NEEDED_REM[variant] * remPx ? "slim" : variant;
}
