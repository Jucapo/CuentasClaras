import { AuthError, AuthRetryableFetchError } from '@supabase/supabase-js';
import {
  authErrorMessage,
  GENERIC_AUTH_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
} from './auth-error-messages';

describe('authErrorMessage', () => {
  it('maps known error codes to Spanish messages', () => {
    const error = new AuthError('Invalid login credentials', 400, 'invalid_credentials');
    expect(authErrorMessage(error)).toBe('Correo o contraseña incorrectos.');
  });

  it('falls back to the generic message for unknown codes', () => {
    expect(authErrorMessage(new AuthError('boom', 500, 'unexpected_failure'))).toBe(
      GENERIC_AUTH_ERROR_MESSAGE,
    );
  });

  it('falls back to the generic message when there is no code', () => {
    expect(authErrorMessage(new AuthError('boom'))).toBe(GENERIC_AUTH_ERROR_MESSAGE);
  });

  it('reports network failures', () => {
    expect(authErrorMessage(new AuthRetryableFetchError('Failed to fetch', 0))).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });
});
