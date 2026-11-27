import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActionResult } from '../../core/action-result';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileService } from '../../core/profiles/profile.service';
import {
  SpaceMembership,
  SpacePatch,
  SpaceSettingsPatch,
  UserSettings,
  UserSettingsPatch,
} from '../../core/spaces/space.models';
import { SpaceService } from '../../core/spaces/space.service';
import { membershipFixture, userSettingsFixture } from '../../core/spaces/space.testing';
import { UserSettingsService } from '../../core/user-settings/user-settings.service';
import { ToastService } from '../../shared/ui/services/toast.service';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  const active = signal<SpaceMembership | null>(null);
  const settings = signal<UserSettings | null>(null);
  const updateActiveSpace = vi.fn<(patch: SpacePatch) => Promise<ActionResult>>();
  const updateActiveSettings = vi.fn<(patch: SpaceSettingsPatch) => Promise<ActionResult>>();
  const update = vi.fn<(patch: UserSettingsPatch) => Promise<ActionResult>>();
  const updateDisplayName = vi.fn<(name: string) => Promise<ActionResult>>();
  const signOut = vi.fn<() => Promise<void>>();
  const show = vi.fn();

  async function setup(role: SpaceMembership['role'] = 'owner') {
    const home = membershipFixture('space-home', 'Hogar', role);
    active.set({ ...home, settings: { ...home.settings, month_start_day: 28 } });
    settings.set(userSettingsFixture({ theme: 'dark' }));
    for (const mock of [updateActiveSpace, updateActiveSettings, update, updateDisplayName]) {
      mock.mockReset().mockResolvedValue({ ok: true });
    }
    signOut.mockReset().mockResolvedValue();
    show.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal({ email: 'ana@example.com' }), signOut },
        },
        {
          provide: SpaceService,
          useValue: {
            active,
            activeSpace: computed(() => active()?.space ?? null),
            activeSettings: computed(() => active()?.settings ?? null),
            canConfigure: computed(() => active()?.role === 'owner'),
            updateActiveSpace,
            updateActiveSettings,
            // The real method: it only decides what to send to the two mocks above.
            saveActivePreferences: SpaceService.prototype.saveActivePreferences,
          },
        },
        { provide: UserSettingsService, useValue: { settings, update } },
        {
          provide: ProfileService,
          useValue: {
            profile: signal({ user_id: 'ana', display_name: 'ana', avatar_url: null }),
            updateDisplayName,
          },
        },
        { provide: ToastService, useValue: { show } },
      ],
    });
    fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function spaceNameInput(): HTMLInputElement {
    return element().querySelector('form[aria-label="Espacio"] input') as HTMLInputElement;
  }

  async function submit(label: string) {
    element()
      .querySelector(`form[aria-label="${label}"]`)
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  it('shows the active space and the user preferences', async () => {
    await setup();

    expect(spaceNameInput().value).toBe('Hogar');
    const preferences = element().querySelector('form[aria-label="Preferencias"]');
    expect(preferences?.textContent).toContain('Oscuro');
    expect(element().textContent).toContain('Sesión iniciada como ana@example.com');
  });

  it('lets the owner rename the space and change its preferences', async () => {
    await setup();
    spaceNameInput().value = ' Casa ';
    spaceNameInput().dispatchEvent(new Event('input'));

    await submit('Espacio');

    expect(updateActiveSpace).toHaveBeenCalledWith({ name: 'Casa' });
    expect(updateActiveSettings).toHaveBeenCalledWith({
      main_currency: 'COP',
      month_start_day: 28,
      week_start: 'monday',
      default_period: 'month',
      budgets_enabled: true,
    });
    expect(show).toHaveBeenCalledWith('Espacio guardado.');
  });

  it('lets the owner choose the default period and turn the budgets off', async () => {
    await setup();
    const budgets = element().querySelector(
      'form[aria-label="Espacio"] [role="switch"]',
    ) as HTMLElement;
    budgets.click();
    await fixture.whenStable();

    await submit('Espacio');

    expect(updateActiveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ budgets_enabled: false }),
    );
  });

  it('saves the display name of the user, trimmed by the service', async () => {
    await setup();
    const name = element().querySelector('form[aria-label="Tu perfil"] input') as HTMLInputElement;
    expect(name.value).toBe('ana');
    name.value = 'Ana María';
    name.dispatchEvent(new Event('input'));

    await submit('Tu perfil');

    expect(updateDisplayName).toHaveBeenCalledWith('Ana María');
    expect(show).toHaveBeenCalledWith('Perfil guardado.');
  });

  it('does not save an empty display name', async () => {
    await setup();
    const name = element().querySelector('form[aria-label="Tu perfil"] input') as HTMLInputElement;
    name.value = '   ';
    name.dispatchEvent(new Event('input'));

    await submit('Tu perfil');

    expect(updateDisplayName).not.toHaveBeenCalled();
  });

  it('does not update the space when its name, icon and color did not change', async () => {
    await setup();
    await submit('Espacio');

    expect(updateActiveSpace).not.toHaveBeenCalled();
    expect(updateActiveSettings).toHaveBeenCalled();
  });

  it('shows the error and keeps the form when saving the space fails', async () => {
    await setup();
    updateActiveSettings.mockResolvedValue({ ok: false, message: 'No tienes permiso.' });

    await submit('Espacio');

    expect(element().querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'No tienes permiso.',
    );
    expect(show).not.toHaveBeenCalled();
  });

  it('shows the space read-only to members who are not the owner', async () => {
    await setup('editor');

    expect(spaceNameInput().disabled).toBe(true);
    expect(element().querySelector('form[aria-label="Espacio"] button[type="submit"]')).toBeNull();
    expect(element().textContent).toContain(
      'Solo el propietario puede cambiar la configuración del espacio.',
    );
  });

  it('invites the owner to complete the setup wizard while it is pending', async () => {
    await setup();

    const row = element().querySelector('a[href="/bienvenida"]');
    expect(row?.textContent).toContain('Completar configuración inicial');
    expect(row?.textContent).toContain('Faltan 6 pasos');
  });

  it('lets the owner review the setup wizard once complete', async () => {
    await setup();
    active.update(
      (membership) =>
        membership && {
          ...membership,
          settings: {
            ...membership.settings,
            onboarding_step: 7,
            onboarding_completed_at: '2026-11-26T10:00:00Z',
          },
        },
    );
    await fixture.whenStable();

    expect(element().querySelector('a[href="/bienvenida"]')?.textContent).toContain(
      'Revisar configuración inicial',
    );
  });

  it('leaves the setup wizard to the owner', async () => {
    await setup('editor');

    expect(element().querySelector('a[href="/bienvenida"]')).toBeNull();
  });

  it('saves the theme and the number format of the user', async () => {
    await setup();
    await submit('Preferencias');

    expect(update).toHaveBeenCalledWith({
      theme: 'dark',
      home_screen: 'categories',
      number_format: 'comma_dot',
      show_decimals: true,
    });
    expect(show).toHaveBeenCalledWith('Preferencias guardadas.');
  });

  it('signs out and goes to the login page', async () => {
    await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    Array.from(element().querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Cerrar sesión'))
      ?.click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/', 'iniciar-sesion']);
  });
});
