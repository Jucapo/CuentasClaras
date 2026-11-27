import { NETWORK_ERROR_MESSAGE } from '../auth/auth-error-messages';
import {
  businessRuleMessage,
  GENERIC_DATA_ERROR_MESSAGE,
  isBusinessRule,
} from '../supabase/data-error-messages';

/** Error codes of the invite-member Edge Function that need their own message. */
const MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  not_authenticated: 'Tu sesión venció. Vuelve a iniciar sesión.',
  not_space_owner: 'Solo el propietario puede invitar o reenviar invitaciones.',
  invalid_email: 'Revisa el correo: no parece válido.',
  invalid_request: 'Revisa el correo: no parece válido.',
  over_email_send_rate_limit:
    'Se enviaron demasiados correos en poco tiempo. Espera un rato e inténtalo de nuevo.',
  email_failed: 'No se pudo enviar el correo. Inténtalo de nuevo.',
};

/**
 * Message of an invite-member failure: its business rule (the RPCs' `P0001` keys), its own code,
 * no connection (null), or the generic one.
 */
export function inviteErrorMessage(code: string | null): string {
  if (code === null) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (isBusinessRule(code)) {
    return businessRuleMessage(code);
  }
  return Object.hasOwn(MESSAGES_BY_CODE, code)
    ? (MESSAGES_BY_CODE[code] ?? GENERIC_DATA_ERROR_MESSAGE)
    : GENERIC_DATA_ERROR_MESSAGE;
}
