import { AuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

const MESSAGES_BY_CODE: Readonly<Partial<Record<string, string>>> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión.',
  over_email_send_rate_limit:
    'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  weak_password: 'La contraseña es demasiado débil. Usa una más larga o variada.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  signup_disabled: 'El registro está cerrado. Pide una invitación.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  email_address_invalid: 'El correo no es válido.',
  session_not_found: 'Tu sesión venció. Vuelve a iniciar sesión.',
};

/** Shown when the auth server cannot be reached. */
export const NETWORK_ERROR_MESSAGE =
  'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/** Shown for errors without a specific message. */
export const GENERIC_AUTH_ERROR_MESSAGE = 'No se pudo completar la operación. Inténtalo de nuevo.';

/** Maps a Supabase Auth error to a user-facing message in Spanish. */
export function authErrorMessage(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) {
    return NETWORK_ERROR_MESSAGE;
  }
  return (error.code && MESSAGES_BY_CODE[error.code]) || GENERIC_AUTH_ERROR_MESSAGE;
}
