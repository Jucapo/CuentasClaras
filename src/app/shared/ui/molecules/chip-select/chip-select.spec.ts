import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { ChipOption, ChipSelect } from './chip-select';

@Component({
  imports: [ChipSelect, FormField],
  template: `
    <cc-chip-select label="Etiquetas por defecto" [options]="options" [formField]="f.tags" />
    <cc-chip-select
      label="Vacío"
      emptyText="Aún no hay etiquetas."
      [options]="[]"
      [formField]="f.none"
    />
  `,
})
class Host {
  readonly options: readonly ChipOption[] = [
    { value: 't1', label: 'Fijos', color: 'indigo' },
    { value: 't2', label: 'Salud' },
  ];
  readonly model = signal<{ tags: readonly string[]; none: readonly string[] }>({
    tags: ['t1'],
    none: [],
  });
  readonly f = form(this.model);
}

describe('ChipSelect', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function chips(): HTMLElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('mat-chip-option'),
    );
  }

  it('labels the listbox and marks the chosen chips', () => {
    const listbox = (fixture.nativeElement as HTMLElement).querySelector('mat-chip-listbox');
    const labelId = listbox?.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(labelId)?.textContent).toBe('Etiquetas por defecto');
    expect(
      chips().map((chip) => chip.querySelector('[role="option"]')?.getAttribute('aria-selected')),
    ).toEqual(['true', 'false']);
    expect(chips()[0].querySelector('cc-color-swatch')).not.toBeNull();
  });

  it('adds and removes values', async () => {
    chips()[1].querySelector<HTMLElement>('button, [role="option"]')?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.model().tags).toEqual(['t1', 't2']);
  });

  it('explains when there is nothing to pick', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aún no hay etiquetas.');
  });
});
