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

/**
 * The people an event is for, in order (its lead, who gives it its colour, first), as
 * one line of names. People no longer in the family are left out.
 */
export function eventMemberNames(
  event: MemberOwned,
  members: readonly { id: string; name: string }[],
): string {
  return orderedMembers(event, members)
    .map((member) => member.name)
    .join(", ");
}

/** The people a shared event is for besides its lead; none for a one-person event. */
export function otherEventMembers<M extends { id: string }>(
  event: MemberOwned,
  members: readonly M[],
): M[] {
  return orderedMembers(event, members).filter(
    (member) => member.id !== event.memberId,
  );
}

function orderedMembers<M extends { id: string }>(
  event: MemberOwned,
  members: readonly M[],
): M[] {
  const ids = eventMemberIds(event);
  const ordered = event.memberId
    ? [event.memberId, ...ids.filter((id) => id !== event.memberId)]
    : ids;
  return ordered.flatMap((id) => {
    const member = members.find((candidate) => candidate.id === id);
    return member ? [member] : [];
  });
}
