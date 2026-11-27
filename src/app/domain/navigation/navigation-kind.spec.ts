import { navigationKind, pathSegments } from './navigation-kind';

describe('navigationKind', () => {
  it('reads the segments of the path, without the query or the fragment', () => {
    expect(pathSegments('/cuentas/a1?vista=mis-finanzas#x')).toEqual(['cuentas', 'a1']);
    expect(pathSegments('/')).toEqual([]);
  });

  it('keeps a navigation that only changes the query, as an inner tab', () => {
    expect(navigationKind('/categorias?clase=gastos', '/categorias?clase=ingresos')).toBe('same');
    expect(navigationKind('/cuentas', '/cuentas?vista=mis-finanzas')).toBe('same');
  });

  it('goes deeper into a screen below and back up out of it', () => {
    expect(navigationKind('/cuentas', '/cuentas/a1')).toBe('deeper');
    expect(navigationKind('/configuracion', '/configuracion/miembros')).toBe('deeper');
    expect(navigationKind('/cuentas/a1', '/cuentas')).toBe('shallower');
    expect(navigationKind('/cuentas/a1/editar', '/cuentas/a1')).toBe('shallower');
  });

  it('moves sideways between tabs and between siblings', () => {
    expect(navigationKind('/cuentas', '/categorias')).toBe('sideways');
    expect(navigationKind('/cuentas/a1', '/cuentas/a2')).toBe('sideways');
    expect(navigationKind('/transacciones', '/configuracion')).toBe('sideways');
  });
});
