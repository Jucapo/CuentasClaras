/** Role of a member in a space (spec §3.1). */
export type MemberRole = 'owner' | 'editor' | 'viewer';

/** What the rules need to know about a member. */
export interface MemberRef {
  readonly userId: string;
  readonly role: MemberRole;
}

/** Owners change the role of the other members, never their own (spec §3.1). */
export function canChangeRole(actor: MemberRef | null, target: MemberRef): boolean {
  return actor?.role === 'owner' && actor.userId !== target.userId;
}

/** Owners remove the other members; everyone leaves on their own instead. */
export function canRemove(actor: MemberRef | null, target: MemberRef): boolean {
  return canChangeRole(actor, target);
}

/** Number of owners among the members. */
export function ownerCount(members: readonly MemberRef[]): number {
  return members.filter((member) => member.role === 'owner').length;
}

/** Anyone may leave a space except its last owner; the database enforces it too. */
export function canLeave(members: readonly MemberRef[], userId: string): boolean {
  const me = members.find((member) => member.userId === userId);
  if (!me) {
    return false;
  }
  return me.role !== 'owner' || ownerCount(members) > 1;
}
