import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { CurrencySelect } from './currency-select';

@Component({
  imports: [CurrencySelect, FormField],
  template: `<cc-currency-select label="Moneda" [formField]="f.currency" />`,
})
class Host {
  readonly model = signal({ currency: 'COP' });
  readonly f = form(this.model, (path) =>
    required(path.currency, { message: 'Elige una moneda.' }),
  );
}

describe('CurrencySelect', () => {
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

  it('offers the supported currencies by name and code', async () => {
    expect(trigger().textContent).toContain('Peso colombiano (COP)');
    trigger().click();
    await fixture.whenStable();
    const options = Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Peso colombiano (COP)',
      'Dólar estadounidense (USD)',
      'Euro (EUR)',
    ]);
  });

  it('writes the chosen code to the form', async () => {
    trigger().click();
    await fixture.whenStable();
    document.querySelectorAll<HTMLElement>('mat-option')[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.model().currency).toBe('USD');
  });

  it('shows the errors of the bound field', async () => {
    fixture.componentInstance.model.set({ currency: '' });
    fixture.componentInstance.f.currency().markAsTouched();
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('mat-error')?.textContent?.trim(),
    ).toBe('Elige una moneda.');
  });
});
