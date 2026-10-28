/** Fixed rail width when shown (spec Section 4.2, ~300px). Tunable in the screenshot gate. */
export const RAIL_WIDTH = 300;
/**
 * Rail width in rem. Elsewhere it is the usual 300px (at the browser's 16px). A
 * wall's larger text makes each 2.75rem day button bigger than a 300px rail's
 * seventh, so there the rail seats seven of them plus its padding.
 */
export function railWidthRem(wall: boolean): number {
  return wall ? 21 : RAIL_WIDTH / 16;
}
/** Minimum comfortable member-lane width before the rail yields its space back. */
export const MIN_LANE_WIDTH = 190;
/** Time-axis gutter width (matches the `w-16` axis = 64px). */
export const TIME_AXIS_WIDTH = 64;
/**
 * Persistent desktop module-nav rail (`NavigationTabs`, `w-20` = 80px, rendered
 * `{!isMobile && <NavigationTabs/>}` in `App.tsx`) sits left of the calendar, so
 * the calendar's content box is `viewport - 80`. The threshold must include it.
 */
export const DESKTOP_NAV_WIDTH = 80;
/** Slack for lane borders/padding so the threshold is not razor-thin. */
export const RAIL_LAYOUT_SLACK = 48;

/**
 * Minimum viewport width at which the mini-month rail can appear for a family
 * of `memberCount`: desktop nav + time axis + lanes + rail + slack. Every part
 * is drawn in rem, so all of it grows with the page's text size (`remPx`),
 * which the wall display mode raises.
 */
export function railThresholdPx(
  memberCount: number,
  remPx = 16,
  wall = false,
): number {
  return (
    (DESKTOP_NAV_WIDTH +
      TIME_AXIS_WIDTH +
      MIN_LANE_WIDTH * Math.max(memberCount, 1) +
      RAIL_LAYOUT_SLACK) *
      (remPx / 16) +
    railWidthRem(wall) * remPx
  );
}
