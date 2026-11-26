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

/** Shown for database errors without a specific message. */
export const GENERIC_DATA_ERROR_MESSAGE = 'No se pudo guardar. Inténtalo de nuevo.';

/** Shown when a read fails for a reason other than the network. */
export const LOAD_ERROR_MESSAGE = 'No se pudo cargar la información. Inténtalo de nuevo.';

/** Minimal shape of a Supabase data error. */
export interface DataError {
  readonly code: string;
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
  return MESSAGES_BY_CODE[error.code] ?? fallback;
}

/** Message for a write that RLS silently filtered out (no rows updated). */
export const NOT_ALLOWED_MESSAGE = MESSAGES_BY_CODE['42501'] ?? GENERIC_DATA_ERROR_MESSAGE;
