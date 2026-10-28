import { createContext, useContext } from "react";

/** A parent who has unlocked the screen around this point with their face and PIN. */
export interface ParentSession {
  approverMemberId: string;
  approverName: string;
  /** Held in memory only, never stored; dropped when the screen locks. */
  pin: string;
}

/** Provided by a screen while a parent has it unlocked (see ParentLock). */
export const ParentSessionContext = createContext<ParentSession | null>(null);

/** The parent who unlocked the surrounding screen, or null when nobody has. */
export function useParentSession(): ParentSession | null {
  return useContext(ParentSessionContext);
}
