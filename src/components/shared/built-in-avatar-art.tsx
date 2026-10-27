import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The pictures drawn for the app, each on a 64×64 canvas and meant to sit inside the
 * member's colour circle. Simple flat shapes so they read at 20 px in a calendar chip
 * and at 96 px on the wall. Keys match {@link BUILT_IN_AVATARS} in `@/lib/avatars`.
 */
const INK = "#2b2b2b";

const ART: Record<string, ReactNode> = {
  fox: (
    <>
      <path
        d="M12 12 L25 25 L39 25 L52 12 L50 36 Q32 58 14 36 Z"
        fill="#f28c38"
      />
      <path d="M17 37 Q32 50 47 37 Q41 49 32 51 Q23 49 17 37 Z" fill="#fff" />
      <circle cx="25" cy="33" r="2.6" fill={INK} />
      <circle cx="39" cy="33" r="2.6" fill={INK} />
      <circle cx="32" cy="43" r="2.6" fill={INK} />
    </>
  ),
  cat: (
    <>
      <path
        d="M15 14 L24 27 L40 27 L49 14 L49 38 Q49 53 32 53 Q15 53 15 38 Z"
        fill="#a7b1bc"
      />
      <ellipse cx="25" cy="37" rx="2.6" ry="3.6" fill={INK} />
      <ellipse cx="39" cy="37" rx="2.6" ry="3.6" fill={INK} />
      <path d="M29.5 43 L34.5 43 L32 46 Z" fill="#f28fa0" />
      <path
        d="M10 41 L22 43 M10 47 L22 45 M54 41 L42 43 M54 47 L42 45"
        stroke={INK}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  bear: (
    <>
      <circle cx="19" cy="21" r="7" fill="#8b5e3c" />
      <circle cx="45" cy="21" r="7" fill="#8b5e3c" />
      <circle cx="32" cy="36" r="17" fill="#8b5e3c" />
      <ellipse cx="32" cy="43" rx="8.5" ry="6.5" fill="#e0bd94" />
      <ellipse cx="32" cy="40.5" rx="3.2" ry="2.4" fill={INK} />
      <circle cx="25" cy="32" r="2.4" fill={INK} />
      <circle cx="39" cy="32" r="2.4" fill={INK} />
    </>
  ),
  owl: (
    <>
      <path
        d="M16 18 L22 24 L42 24 L48 18 L48 40 Q48 56 32 56 Q16 56 16 40 Z"
        fill="#8a6d4e"
      />
      <ellipse cx="32" cy="46" rx="10" ry="8" fill="#c9a77c" />
      <circle cx="25" cy="32" r="7" fill="#fff" />
      <circle cx="39" cy="32" r="7" fill="#fff" />
      <circle cx="25" cy="32" r="3.2" fill={INK} />
      <circle cx="39" cy="32" r="3.2" fill={INK} />
      <path d="M29 37 L35 37 L32 42 Z" fill="#f2a93b" />
    </>
  ),
  rabbit: (
    <>
      <ellipse cx="24" cy="18" rx="5.5" ry="13" fill="#f4f4f4" />
      <ellipse cx="40" cy="18" rx="5.5" ry="13" fill="#f4f4f4" />
      <ellipse cx="24" cy="18" rx="2.6" ry="9" fill="#f6b8c6" />
      <ellipse cx="40" cy="18" rx="2.6" ry="9" fill="#f6b8c6" />
      <circle cx="32" cy="40" r="15" fill="#f4f4f4" />
      <circle cx="26" cy="37" r="2.4" fill={INK} />
      <circle cx="38" cy="37" r="2.4" fill={INK} />
      <ellipse cx="32" cy="43" rx="2.6" ry="2" fill="#f28fa0" />
    </>
  ),
  panda: (
    <>
      <circle cx="18" cy="21" r="7" fill={INK} />
      <circle cx="46" cy="21" r="7" fill={INK} />
      <circle cx="32" cy="36" r="17" fill="#fff" />
      <ellipse
        cx="25"
        cy="34"
        rx="5"
        ry="6.5"
        fill={INK}
        transform="rotate(-25 25 34)"
      />
      <ellipse
        cx="39"
        cy="34"
        rx="5"
        ry="6.5"
        fill={INK}
        transform="rotate(25 39 34)"
      />
      <circle cx="25.5" cy="33.5" r="1.8" fill="#fff" />
      <circle cx="38.5" cy="33.5" r="1.8" fill="#fff" />
      <ellipse cx="32" cy="42" rx="3.4" ry="2.4" fill={INK} />
    </>
  ),
  frog: (
    <>
      <circle cx="21" cy="25" r="8" fill="#5cb85c" />
      <circle cx="43" cy="25" r="8" fill="#5cb85c" />
      <ellipse cx="32" cy="40" rx="20" ry="14" fill="#5cb85c" />
      <circle cx="21" cy="25" r="4.5" fill="#fff" />
      <circle cx="43" cy="25" r="4.5" fill="#fff" />
      <circle cx="21" cy="25" r="2.2" fill={INK} />
      <circle cx="43" cy="25" r="2.2" fill={INK} />
      <path
        d="M21 43 Q32 51 43 43"
        stroke={INK}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  penguin: (
    <>
      <ellipse cx="32" cy="37" rx="16" ry="20" fill={INK} />
      <ellipse cx="32" cy="42" rx="10.5" ry="14" fill="#fff" />
      <circle cx="27" cy="30" r="2.2" fill="#fff" />
      <circle cx="37" cy="30" r="2.2" fill="#fff" />
      <circle cx="27" cy="30" r="1.1" fill={INK} />
      <circle cx="37" cy="30" r="1.1" fill={INK} />
      <path d="M28.5 35 L35.5 35 L32 39.5 Z" fill="#f2a93b" />
    </>
  ),
  star: (
    <path
      d="M32 9 L38.8 23.6 L54.8 25.3 L42.8 36.1 L46.1 51.9 L32 43.9 L17.9 51.9 L21.2 36.1 L9.2 25.3 L25.2 23.6 Z"
      fill="#ffd23f"
      stroke="#e0a800"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
  rocket: (
    <>
      <path d="M32 8 Q44 20 42 40 L22 40 Q20 20 32 8 Z" fill="#f4f4f4" />
      <circle
        cx="32"
        cy="25"
        r="5"
        fill="#4aa3df"
        stroke="#2b6f9e"
        strokeWidth="1.5"
      />
      <path d="M22 32 L14 44 L22 42 Z M42 32 L50 44 L42 42 Z" fill="#e5484d" />
      <path d="M26 40 L32 54 L38 40 Z" fill="#f2a93b" />
    </>
  ),
  heart: (
    <path
      d="M32 52 L14 34 Q6 25 13 17 Q21 10 32 21 Q43 10 51 17 Q58 25 50 34 Z"
      fill="#ff5a6e"
      stroke="#d63649"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
  sun: (
    <>
      <g stroke="#ffd23f" strokeWidth="4" strokeLinecap="round">
        <path d="M32 6 V14 M32 50 V58 M6 32 H14 M50 32 H58 M13.6 13.6 L19.3 19.3 M44.7 44.7 L50.4 50.4 M13.6 50.4 L19.3 44.7 M44.7 19.3 L50.4 13.6" />
      </g>
      <circle cx="32" cy="32" r="13" fill="#ffd23f" />
    </>
  ),
};

/** Draws one built-in picture; nothing for a key the app does not know. */
export function BuiltInAvatarArt({
  avatarKey,
  className,
}: {
  avatarKey: string;
  className?: string;
}) {
  const art = ART[avatarKey];
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-avatar-key={avatarKey}
      className={cn("h-full w-full", className)}
    >
      {art}
    </svg>
  );
}
