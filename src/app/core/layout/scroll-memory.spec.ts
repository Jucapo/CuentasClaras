import { scrollActionFor } from './scroll-memory';

describe('scrollActionFor', () => {
  // Spec §13.5: each tab keeps its scroll, a detail starts at the top, inner tabs keep it.
  it('restores a tab and the list a detail came from', () => {
    expect(scrollActionFor('/categorias', '/cuentas')).toBe('restore');
    expect(scrollActionFor('/cuentas/a1', '/cuentas')).toBe('restore');
  });

  it('starts a deeper screen at the top', () => {
    expect(scrollActionFor('/cuentas', '/cuentas/a1')).toBe('top');
  });

  it('leaves the scroll alone when only the query changes', () => {
    expect(scrollActionFor('/cuentas', '/cuentas?vista=mis-finanzas')).toBe('keep');
  });
});
