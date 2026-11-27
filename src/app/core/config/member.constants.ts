import { MemberRole } from '../spaces/space.models';

/** Name of each role, as the app shows it (spec §3.1). */
export const MEMBER_ROLE_LABELS: Readonly<Record<MemberRole, string>> = {
  owner: 'Propietario',
  editor: 'Editor',
  viewer: 'Lector',
};

/** What each role can do (spec §3.1), for the role choices. */
export const MEMBER_ROLE_DESCRIPTIONS: Readonly<Record<MemberRole, string>> = {
  owner: 'Todo, incluido invitar o quitar miembros y cambiar la configuración del espacio.',
  editor: 'Registra y edita movimientos, cuentas compartidas, categorías, etiquetas y presupuestos.',
  viewer: 'Ve lo compartido, sin cambiar nada.',
};

/** Roles in the order they are offered; a new invitation starts as editor. */
export const MEMBER_ROLES: readonly MemberRole[] = ['owner', 'editor', 'viewer'];

/** Role preselected when inviting someone. */
export const DEFAULT_INVITE_ROLE: MemberRole = 'editor';

/** Edge Function that invites someone to a space or resends an invitation (spec §3.3). */
export const INVITE_MEMBER_FUNCTION = 'invite-member';
