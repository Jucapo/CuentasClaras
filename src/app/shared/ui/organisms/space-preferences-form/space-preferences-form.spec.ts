import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apply, form } from '@angular/forms/signals';
import { SpacePreferences, spacePreferencesSchema } from './space-preferences';
import { SpacePreferencesForm } from './space-preferences-form';

@Component({
  imports: [SpacePreferencesForm],
  template: `<cc-space-preferences-form [fields]="f.space" />`,
})
class Host {
  readonly model = signal<{ space: SpacePreferences }>({
    space: { name: 'Hogar', mainCurrency: 'COP', monthStartDay: 28, weekStart: 'sunday' },
  });
  readonly f = form(this.model, (path) => {
    apply(path.space, spacePreferencesSchema);
  });
}

describe('SpacePreferencesForm', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the four space preferences with their current values', () => {
    const labels = Array.from(element().querySelectorAll('mat-label')).map((label) =>
      label.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Nombre del espacio',
      'Moneda principal',
      'Primer día del mes',
      'Primer día de la semana',
    ]);
    expect(element().querySelector('input')?.value).toBe('Hogar');
    const triggers = Array.from(element().querySelectorAll('.mat-mdc-select-trigger')).map(
      (trigger) => trigger.textContent?.trim(),
    );
    expect(triggers).toEqual(['Peso colombiano (COP)', '28', 'Domingo']);
  });

  it('explains the monthly period of the chosen first day', async () => {
    expect(element().textContent).toContain('Cada mes va del 28 al 27 del mes siguiente.');

    fixture.componentInstance.model.update((m) => ({ space: { ...m.space, monthStartDay: 1 } }));
    await fixture.whenStable();

    expect(element().textContent).toContain('Cada mes va del 1 al último día del mes.');
  });

  it('rejects a blank or too long name', () => {
    const name = fixture.componentInstance.f.space.name;

    fixture.componentInstance.model.update((m) => ({ space: { ...m.space, name: '   ' } }));
    expect(
      name()
        .errors()
        .map((error) => error.message),
    ).toContain('Ponle un nombre al espacio.');

    fixture.componentInstance.model.update((m) => ({
      space: { ...m.space, name: 'x'.repeat(61) },
    }));
    expect(
      name()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Usa máximo 60 caracteres.']);
  });
});
