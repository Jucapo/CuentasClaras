import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActionResult, DataResult } from '../../../../core/action-result';
import { NewSpace, UserSettings, UserSettingsPatch } from '../../../../core/spaces/space.models';
import { SpaceService } from '../../../../core/spaces/space.service';
import { userSettingsFixture } from '../../../../core/spaces/space.testing';
import { UserSettingsService } from '../../../../core/user-settings/user-settings.service';
import { SpaceStep } from './space-step';

describe('SpaceStep', () => {
  let fixture: ComponentFixture<SpaceStep>;
  let calls: string[];
  const settings = signal<UserSettings | null>(null);
  const update = vi.fn<(patch: UserSettingsPatch) => Promise<ActionResult>>();
  const createSpace = vi.fn<(input: NewSpace) => Promise<DataResult<string>>>();

  async function setup(initialSettings: UserSettings | null = userSettingsFixture()) {
    calls = [];
    settings.set(initialSettings);
    update.mockReset().mockImplementation(async () => {
      calls.push('update');
      return { ok: true };
    });
    createSpace.mockReset().mockImplementation(async () => {
      calls.push('createSpace');
      return { ok: true, value: 'space-1' };
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UserSettingsService, useValue: { settings, update } },
        { provide: SpaceService, useValue: { createSpace } },
      ],
    });
    fixture = TestBed.createComponent(SpaceStep);
    await fixture.whenStable();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function typeName(value: string) {
    const input = element().querySelector<HTMLInputElement>('cc-text-field input');
    if (!input) {
      throw new Error('Missing the space name input');
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

  it('asks for a name before creating anything', async () => {
    await setup();
    typeName('   ');
    await submit();

    expect(element().querySelector('mat-error')?.textContent?.trim()).toBe(
      'Ponle un nombre al espacio.',
    );
    expect(update).not.toHaveBeenCalled();
    expect(createSpace).not.toHaveBeenCalled();
  });

  it('saves the number format, then creates the space and enters the app', async () => {
    await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    typeName('  Hogar  ');
    await submit();

    expect(calls).toEqual(['update', 'createSpace']);
    expect(update).toHaveBeenCalledWith({ number_format: 'comma_dot', show_decimals: true });
    expect(createSpace).toHaveBeenCalledWith({
      name: 'Hogar',
      mainCurrency: 'COP',
      monthStartDay: 1,
      weekStart: 'monday',
    });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('starts from the number format the user already has', async () => {
    await setup(userSettingsFixture({ number_format: 'dot_comma', show_decimals: false }));

    typeName('Hogar');
    await submit();

    expect(update).toHaveBeenCalledWith({ number_format: 'dot_comma', show_decimals: false });
  });

  it('does not create the space when the number format cannot be saved', async () => {
    await setup();
    update.mockResolvedValue({ ok: false, message: 'No hay conexión con el servidor.' });

    typeName('Hogar');
    await submit();

    expect(createSpace).not.toHaveBeenCalled();
    expect(element().querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'No hay conexión con el servidor.',
    );
  });

  it('stays on the step with the error when the space cannot be created', async () => {
    await setup();
    createSpace.mockResolvedValue({ ok: false, message: 'Revisa los datos.' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    typeName('Hogar');
    await submit();

    expect(navigate).not.toHaveBeenCalled();
    expect(element().querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Revisa los datos.',
    );
  });
});
