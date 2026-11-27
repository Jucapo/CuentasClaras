import { NETWORK_ERROR_MESSAGE } from '../auth/auth-error-messages';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { inviteErrorMessage } from './invitation-error-messages';

describe('inviteErrorMessage', () => {
  it('reuses the database messages for the business rules', () => {
    expect(inviteErrorMessage('invitation_pending')).toBe(
      'Ya hay una invitación pendiente para ese correo. Puedes reenviarla.',
    );
    expect(inviteErrorMessage('already_member')).toBe('Esa persona ya es miembro del espacio.');
  });

  it('explains the errors of the function itself', () => {
    expect(inviteErrorMessage('not_space_owner')).toBe(
      'Solo el propietario puede invitar o reenviar invitaciones.',
    );
    expect(inviteErrorMessage('email_failed')).toBe(
      'No se pudo enviar el correo. Inténtalo de nuevo.',
    );
    expect(inviteErrorMessage('over_email_send_rate_limit')).toContain('demasiados correos');
  });

  it('reports a missing connection and falls back to the generic message', () => {
    expect(inviteErrorMessage(null)).toBe(NETWORK_ERROR_MESSAGE);
    expect(inviteErrorMessage('misconfigured')).toBe(GENERIC_DATA_ERROR_MESSAGE);
    expect(inviteErrorMessage('constructor')).toBe(GENERIC_DATA_ERROR_MESSAGE);
  });
});
