import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { Select, SelectOption } from './select';

@Component({
  imports: [Select, FormField],
  template: `<cc-select label="Moneda" [options]="options" [formField]="f.currency" />`,
})
class Host {
  readonly options: readonly SelectOption<string>[] = [
    { value: 'COP', label: 'Peso colombiano' },
    { value: 'USD', label: 'Dólar estadounidense' },
  ];
  readonly model = signal({ currency: 'COP' });
  readonly f = form(this.model);
}

describe('Select', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function trigger(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.mat-mdc-select-trigger',
    ) as HTMLElement;
  }

  it('shows the label of the selected value', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('mat-label')?.textContent,
    ).toContain('Moneda');
    expect(trigger().textContent).toContain('Peso colombiano');
  });

  it('writes the chosen option to the form', async () => {
    trigger().click();
    await fixture.whenStable();

    const options = Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Peso colombiano',
      'Dólar estadounidense',
    ]);

    options[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().currency).toBe('USD');
    expect(trigger().textContent).toContain('Dólar estadounidense');
  });
});

@Component({
  imports: [Select, FormField],
  template: `<cc-select label="Tipo" [options]="options" [formField]="f.kind" />`,
})
class GroupedHost {
  readonly options: readonly SelectOption<string>[] = [
    { value: 'cash', label: 'Efectivo', group: 'Cuentas' },
    { value: 'bank', label: 'Banco', group: 'Cuentas' },
    { value: 'loan', label: 'Préstamo', group: 'Deudas' },
  ];
  readonly model = signal({ kind: 'bank' });
  readonly f = form(this.model);
}

describe('Select with groups', () => {
  it('shows each group under its heading, in order', async () => {
    const fixture = TestBed.createComponent(GroupedHost);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('.mat-mdc-select-trigger')
      ?.click();
    await fixture.whenStable();

    const groups = Array.from(document.querySelectorAll<HTMLElement>('mat-optgroup'));
    expect(
      groups.map((group) => group.querySelector('.mat-mdc-optgroup-label')?.textContent?.trim()),
    ).toEqual(['Cuentas', 'Deudas']);
    expect(groups.map((group) => group.querySelectorAll('mat-option').length)).toEqual([2, 1]);
  });
});
