import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { FEATURE_FLAGS } from './core/config/feature-flags';

describe('app routes', () => {
  const isAuthenticated = signal(false);

  async function navigate(url: string, signedIn: boolean) {
    isAuthenticated.set(signedIn);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        {
          provide: AuthService,
          useValue: { isAuthenticated, user: signal(null), signIn: vi.fn() },
        },
        { provide: FEATURE_FLAGS, useValue: { publicSignup: false } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return { harness, url: TestBed.inject(Router).url };
  }

  it('sends signed-out users from "/" to the login form', async () => {
    const { harness, url } = await navigate('/', false);

    expect(url).toBe('/iniciar-sesion?redirect=%2Fcategorias');
    expect(harness.routeNativeElement?.querySelector('cc-auth-layout form')).not.toBeNull();
  });

  it('opens the categories page for signed-in users at "/"', async () => {
    const { harness, url } = await navigate('/', true);

    expect(url).toBe('/categorias');
    expect(
      harness.routeNativeElement?.querySelector('app-shell app-categories-page'),
    ).not.toBeNull();
  });

  it('does not expose the sign-up page while public sign-up is closed', async () => {
    const { url } = await navigate('/registro', false);

    expect(url).toBe('/iniciar-sesion?redirect=%2Fcategorias');
  });

  it('sends unknown URLs to the home page', async () => {
    const { url } = await navigate('/no-existe', true);

    expect(url).toBe('/categorias');
  });
});
