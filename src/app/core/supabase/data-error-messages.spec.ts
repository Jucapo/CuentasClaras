import { NETWORK_ERROR_MESSAGE } from '../auth/auth-error-messages';
import {
  dataErrorMessage,
  GENERIC_DATA_ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
} from './data-error-messages';

describe('dataErrorMessage', () => {
  it('reports a missing connection when the request never got a response', () => {
    expect(dataErrorMessage({ code: '' }, 0)).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('maps permission and validation errors to Spanish messages', () => {
    expect(dataErrorMessage({ code: '42501' }, 403)).toBe(
      'No tienes permiso para hacer este cambio.',
    );
    expect(dataErrorMessage({ code: '23514' }, 400)).toBe(
      'Revisa los datos: hay un valor que no es válido.',
    );
  });

  it('explains a delete blocked by records that still use the row', () => {
    expect(dataErrorMessage({ code: '23503' }, 409)).toBe(
      'Este registro está en uso, así que no se puede eliminar.',
    );
  });

  it('falls back to the generic or the given message for other errors', () => {
    expect(dataErrorMessage({ code: 'PGRST116' }, 406)).toBe(GENERIC_DATA_ERROR_MESSAGE);
    expect(dataErrorMessage({ code: 'XX000' }, 500, LOAD_ERROR_MESSAGE)).toBe(LOAD_ERROR_MESSAGE);
  });
});
