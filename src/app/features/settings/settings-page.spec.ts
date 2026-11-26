import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActionResult } from '../../core/action-result';
import { AuthService } from '../../core/auth/auth.service';
import {
  SpaceMembership,
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
  const renameActiveSpace = vi.fn<(name: string) => Promise<ActionResult>>();
  const updateActiveSettings = vi.fn<(patch: SpaceSettingsPatch) => Promise<ActionResult>>();
  const update = vi.fn<(patch: UserSettingsPatch) => Promise<ActionResult>>();
  const signOut = vi.fn<() => Promise<void>>();
  const show = vi.fn();

  async function setup(role: SpaceMembership['role'] = 'owner') {
    const home = membershipFixture('space-home', 'Hogar', role);
    active.set({ ...home, settings: { ...home.settings, month_start_day: 28 } });
    settings.set(userSettingsFixture({ theme: 'dark' }));
    for (const mock of [renameActiveSpace, updateActiveSettings, update]) {
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
            canConfigure: computed(() => active()?.role === 'owner'),
            renameActiveSpace,
            updateActiveSettings,
          },
        },
        { provide: UserSettingsService, useValue: { settings, update } },
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

    expect(renameActiveSpace).toHaveBeenCalledWith('Casa');
    expect(updateActiveSettings).toHaveBeenCalledWith({
      main_currency: 'COP',
      month_start_day: 28,
      week_start: 'monday',
    });
    expect(show).toHaveBeenCalledWith('Espacio guardado.');
  });

  it('does not rename the space when the name did not change', async () => {
    await setup();
    await submit('Espacio');

    expect(renameActiveSpace).not.toHaveBeenCalled();
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

  it('saves the theme and the number format of the user', async () => {
    await setup();
    await submit('Preferencias');

    expect(update).toHaveBeenCalledWith({
      theme: 'dark',
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
