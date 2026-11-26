import { isShellUrl } from './origin-url';

describe('isShellUrl', () => {
  it('accepts screens of the signed-in app, with or without query params', () => {
    expect(isShellUrl('/categorias?clase=gasto')).toBe(true);
    expect(isShellUrl('/configuracion')).toBe(true);
    expect(isShellUrl('/configuracion/etiquetas')).toBe(true);
  });

  it('rejects the sign-in pages, the setup wizard and the bare root', () => {
    expect(isShellUrl('/iniciar-sesion?redirect=%2Fcuentas')).toBe(false);
    expect(isShellUrl('/restablecer-contrasena')).toBe(false);
    expect(isShellUrl('/bienvenida/espacio')).toBe(false);
    expect(isShellUrl('/')).toBe(false);
  });
});
