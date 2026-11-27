import { screenTransition, TransitionEnd } from './view-transitions';

const screen = (url: string, chrome = true, sideBySide = false): TransitionEnd => ({
  url,
  chrome,
  sideBySide,
});

describe('screenTransition', () => {
  // Spec §13.5: tabs fade, deeper screens slide in and out, only the content moves.
  it('fades between tabs and slides into and out of a deeper screen', () => {
    expect(screenTransition(screen('/cuentas'), screen('/categorias'))).toEqual({
      kind: 'fade',
      scope: 'content',
    });
    expect(screenTransition(screen('/configuracion'), screen('/configuracion/miembros'))).toEqual({
      kind: 'forward',
      scope: 'content',
    });
    expect(screenTransition(screen('/configuracion/miembros'), screen('/configuracion'))).toEqual({
      kind: 'back',
      scope: 'content',
    });
  });

  it('slides the whole page when the header and the navigation come or go', () => {
    expect(screenTransition(screen('/cuentas'), screen('/cuentas/a1', false))).toEqual({
      kind: 'forward',
      scope: 'page',
    });
    expect(screenTransition(screen('/transacciones'), screen('/configuracion', false))).toEqual({
      kind: 'forward',
      scope: 'page',
    });
    expect(screenTransition(screen('/cuentas/a1', false), screen('/cuentas'))).toEqual({
      kind: 'back',
      scope: 'page',
    });
  });

  it('skips a change of query and the detail beside a list', () => {
    expect(screenTransition(screen('/cuentas'), screen('/cuentas?vista=mis-finanzas'))).toBeNull();
    expect(
      screenTransition(screen('/cuentas', true, true), screen('/cuentas/a1', true, true)),
    ).toBeNull();
  });
});
