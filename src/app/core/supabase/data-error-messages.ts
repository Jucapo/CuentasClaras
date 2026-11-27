import { NETWORK_ERROR_MESSAGE } from '../auth/auth-error-messages';

/** foreign_key_violation: a delete blocked by rows that still use the record (e.g. movements). */
export const FOREIGN_KEY_VIOLATION = '23503';

const MESSAGES_BY_CODE: Readonly<Partial<Record<string, string>>> = {
  // insufficient_privilege: RLS, a missing grant or a rule enforced by a function.
  '42501': 'No tienes permiso para hacer este cambio.',
  // check_violation: a value outside the allowed range.
  '23514': 'Revisa los datos: hay un valor que no es válido.',
  // unique_violation.
  '23505': 'Ya existe un registro con esos datos.',
  [FOREIGN_KEY_VIOLATION]: 'Este registro está en uso, así que no se puede eliminar.',
};

/** raise_exception: a business rule of an RPC or trigger, named by a stable key in the message. */
export const BUSINESS_RULE_ERROR = 'P0001';

/** Business rules the database reports with `P0001` (spec §3.3 and §8). */
export type BusinessRule =
  | 'last_owner'
  | 'already_member'
  | 'invitation_pending'
  | 'invitation_closed'
  | 'invitation_not_found'
  | 'invitation_revoked'
  | 'invitation_used'
  | 'invitation_expired'
  | 'invitation_email_mismatch';

const MESSAGES_BY_RULE: Readonly<Record<BusinessRule, string>> = {
  last_owner: 'El espacio necesita al menos un propietario. Nombra a otro propietario antes.',
  already_member: 'Esa persona ya es miembro del espacio.',
  invitation_pending: 'Ya hay una invitación pendiente para ese correo. Puedes reenviarla.',
  invitation_closed: 'Esa invitación ya no está pendiente.',
  invitation_not_found: 'Esta invitación no existe o el link está incompleto.',
  invitation_revoked: 'Esta invitación fue revocada.',
  invitation_used: 'Esta invitación ya se usó.',
  invitation_expired: 'Esta invitación venció. Pide que te inviten de nuevo.',
  invitation_email_mismatch: 'Esta invitación es para otro correo.',
};

/** Whether a key is one of the business rules the app knows. */
export function isBusinessRule(key: string): key is BusinessRule {
  return Object.hasOwn(MESSAGES_BY_RULE, key);
}

/** The business rule a database error reports, if any. */
export function businessRule(error: DataError): BusinessRule | null {
  const key = error.message ?? '';
  return error.code === BUSINESS_RULE_ERROR && isBusinessRule(key) ? key : null;
}

/** User-facing message of a business rule. */
export function businessRuleMessage(rule: BusinessRule): string {
  return MESSAGES_BY_RULE[rule];
}

/** Shown for database errors without a specific message. */
export const GENERIC_DATA_ERROR_MESSAGE = 'No se pudo guardar. Inténtalo de nuevo.';

/** Shown when a read fails for a reason other than the network. */
export const LOAD_ERROR_MESSAGE = 'No se pudo cargar la información. Inténtalo de nuevo.';

/** Minimal shape of a Supabase data error. */
export interface DataError {
  readonly code: string;
  /** For `P0001`, the key of the business rule. */
  readonly message?: string;
}

/** Maps a PostgREST error to a user-facing message in Spanish; status 0 means no connection. */
export function dataErrorMessage(
  error: DataError,
  status: number,
  fallback = GENERIC_DATA_ERROR_MESSAGE,
): string {
  if (status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }
  const rule = businessRule(error);
  if (rule) {
    return businessRuleMessage(rule);
  }
  return MESSAGES_BY_CODE[error.code] ?? fallback;
}

/** Message for a write that RLS silently filtered out (no rows updated). */
export const NOT_ALLOWED_MESSAGE = MESSAGES_BY_CODE['42501'] ?? GENERIC_DATA_ERROR_MESSAGE;
