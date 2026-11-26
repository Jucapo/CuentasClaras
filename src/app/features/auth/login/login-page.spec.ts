import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthResult, AuthService } from '../../../core/auth/auth.service';
import { FEATURE_FLAGS } from '../../../core/config/feature-flags';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let signIn: ReturnType<typeof vi.fn<(email: string, password: string) => Promise<AuthResult>>>;

  async function setup(publicSignup = false) {
    signIn = vi.fn<(email: string, password: string) => Promise<AuthResult>>();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { signIn } },
        { provide: FEATURE_FLAGS, useValue: { publicSignup } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function type(selector: string, value: string) {
    const input = element().querySelector<HTMLInputElement>(selector);
    if (!input) {
      throw new Error(`Missing input ${selector}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function submit() {
    element()
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  it('shows validation errors and does not sign in when the form is empty', async () => {
    await setup();
    await submit();

    const errors = Array.from(element().querySelectorAll('mat-error')).map((e) =>
      e.textContent?.trim(),
    );
    expect(errors).toEqual(['Ingresa tu correo.', 'Ingresa tu contraseña.']);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed email and goes home', async () => {
    await setup();
    signIn.mockResolvedValue({ ok: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    type('input[type="email"]', '  juan@example.com ');
    type('input[autocomplete="current-password"]', 'secret-password');
    await submit();

    expect(signIn).toHaveBeenCalledWith('juan@example.com', 'secret-password');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows the server error message when sign-in fails', async () => {
    await setup();
    signIn.mockResolvedValue({ ok: false, message: 'Correo o contraseña incorrectos.' });

    type('input[type="email"]', 'juan@example.com');
    type('input[autocomplete="current-password"]', 'wrong-password');
    await submit();

    expect(element().querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Correo o contraseña incorrectos.',
    );
  });

  it('only links to sign-up when public sign-up is enabled', async () => {
    await setup(false);
    expect(element().querySelector('a[href="/registro"]')).toBeNull();

    TestBed.resetTestingModule();
    await setup(true);
    expect(element().querySelector('a[href="/registro"]')).not.toBeNull();
  });
});
