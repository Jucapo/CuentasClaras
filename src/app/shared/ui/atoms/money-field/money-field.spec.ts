import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { MoneyField } from './money-field';

@Component({
  imports: [MoneyField, FormField],
  template: `
    <cc-money-field label="Saldo" currency="COP" [formField]="f.balance" />
    <cc-money-field
      label="Ajuste"
      currency="USD"
      [allowNegative]="true"
      [formField]="f.adjustment"
    />
  `,
})
class Host {
  readonly model = signal<{ balance: number | null; adjustment: number | null }>({
    balance: 150000,
    adjustment: null,
  });
  readonly f = form(this.model);
}

describe('MoneyField', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function inputs(): HTMLInputElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'));
  }

  async function type(input: HTMLInputElement, text: string): Promise<void> {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function blur(input: HTMLInputElement): Promise<void> {
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  function error(): string | undefined {
    return (fixture.nativeElement as HTMLElement).querySelector('mat-error')?.textContent?.trim();
  }

  it('shows the amount with the currency symbol and the user grouping', () => {
    const [balance] = inputs();
    expect(balance.value).toBe('1,500');
    expect(balance.getAttribute('inputmode')).toBe('decimal');
    expect((fixture.nativeElement as HTMLElement).querySelector('.symbol')?.textContent).toContain(
      '$',
    );
  });

  it('stores what the user types in minor units', async () => {
    const [balance] = inputs();
    await type(balance, '2,500.5');
    expect(fixture.componentInstance.model().balance).toBe(250050);
  });

  it('formats the amount when the user leaves the field', async () => {
    const [balance] = inputs();
    await type(balance, '2500.5');
    await blur(balance);
    expect(balance.value).toBe('2,500.50');
  });

  it('stores null for an empty field', async () => {
    const [balance] = inputs();
    await type(balance, '');
    expect(fixture.componentInstance.model().balance).toBeNull();
  });

  it('reports what it cannot read as an error of the field', async () => {
    const [balance] = inputs();
    await type(balance, '1,5');
    await blur(balance);
    expect(fixture.componentInstance.f.balance().invalid()).toBe(true);
    expect(fixture.componentInstance.model().balance).toBe(150000);
    expect(balance.value).toBe('1,5');
    expect(error()).toBe('Revisa los separadores: los decimales van después de «.».');
  });

  it('rejects negative amounts unless allowed', async () => {
    const [balance, adjustment] = inputs();
    await type(balance, '-5');
    await blur(balance);
    expect(error()).toBe('El monto no puede ser negativo.');

    await type(adjustment, '-5');
    expect(fixture.componentInstance.model().adjustment).toBe(-500);
  });
});
