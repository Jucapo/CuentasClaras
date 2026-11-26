import { deleteResult, isInUse } from './catalog-result';

const IN_USE = 'Esta cuenta tiene movimientos, así que no se puede eliminar.';

describe('deleteResult', () => {
  it('succeeds when a row was deleted', () => {
    const result = deleteResult(null, 200, 1, IN_USE);
    expect(result).toEqual({ ok: true });
    expect(isInUse(result)).toBe(false);
  });

  it('explains that a row with movements can only be archived', () => {
    const result = deleteResult({ code: '23503' }, 409, 0, IN_USE);
    expect(result).toEqual({ ok: false, message: IN_USE, inUse: true });
    expect(isInUse(result)).toBe(true);
  });

  it('reports a row hidden by RLS as not allowed', () => {
    expect(deleteResult(null, 200, 0, IN_USE)).toEqual({
      ok: false,
      message: 'No tienes permiso para hacer este cambio.',
    });
  });

  it('maps other errors like any write', () => {
    const result = deleteResult({ code: '42501' }, 403, 0, IN_USE);
    expect(result).toEqual({ ok: false, message: 'No tienes permiso para hacer este cambio.' });
    expect(isInUse(result)).toBe(false);
  });
});
