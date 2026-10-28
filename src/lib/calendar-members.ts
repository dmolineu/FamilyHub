/**
 * Which members a calendar entry belongs to. Most entries have one (`memberId`); a
 * followed team's game belongs to all of its fans (`memberIds`), and a game nobody is
 * a fan of belongs to no one, which keeps it out of every lane but on the calendar.
 */
interface MemberOwned {
  memberId: string;
  memberIds?: string[];
}

/** Every member an entry belongs to. */
export function eventMemberIds(event: MemberOwned): string[] {
  if (event.memberIds) return event.memberIds;
  return event.memberId ? [event.memberId] : [];
}

/** Whether the entry goes in this member's lane. */
export function belongsToMember(event: MemberOwned, memberId: string): boolean {
  return eventMemberIds(event).includes(memberId);
}

/**
 * Whether the entry passes the member filter: any of its members is shown, or it
 * belongs to no one (such entries are the family's and always show).
 */
export function matchesMemberFilter(
  event: MemberOwned,
  selectedMembers: readonly string[],
): boolean {
  const members = eventMemberIds(event);
  return (
    members.length === 0 || members.some((id) => selectedMembers.includes(id))
  );
}
