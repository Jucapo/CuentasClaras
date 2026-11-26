import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SegmentedControl, SegmentOption } from './segmented-control';

@Component({
  imports: [SegmentedControl],
  template: `<cc-segmented-control label="Clase" [options]="options" [(value)]="kind" />`,
})
class Host {
  readonly options: readonly SegmentOption<string>[] = [
    { value: 'expense', label: 'Gastos' },
    { value: 'income', label: 'Ingresos' },
  ];
  readonly kind = signal('expense');
}

describe('SegmentedControl', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  it('is a named radio group with one checked segment', () => {
    const group = (fixture.nativeElement as HTMLElement).querySelector('mat-button-toggle-group');
    expect(group?.getAttribute('aria-label')).toBe('Clase');
    expect(group?.getAttribute('role')).toBe('radiogroup');
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Gastos', 'Ingresos']);
    expect(buttons().map((button) => button.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
    ]);
  });

  it('writes the chosen segment', async () => {
    buttons()[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.kind()).toBe('income');
  });
});
