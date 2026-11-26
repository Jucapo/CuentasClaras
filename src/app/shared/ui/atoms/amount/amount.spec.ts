import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MoneyFormatOptions } from '../../../../domain/money/number-format';
import { MONEY_FORMAT } from '../../money/money-format';
import { Amount } from './amount';

@Component({
  imports: [Amount],
  template: `
    <cc-amount [amount]="-123456790" currency="COP" />
    <cc-amount [amount]="100000" currency="USD" />
    <cc-amount [amount]="-500" currency="COP" tone="neutral" />
  `,
})
class Host {}

describe('Amount', () => {
  const format = signal<MoneyFormatOptions>({ numberFormat: 'comma_dot', showDecimals: true });
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    format.set({ numberFormat: 'comma_dot', showDecimals: true });
    TestBed.configureTestingModule({ providers: [{ provide: MONEY_FORMAT, useValue: format }] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function amounts(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('cc-amount'));
  }

  it('formats amounts with sign and currency symbol', () => {
    expect(amounts().map((amount) => amount.textContent?.trim())).toEqual([
      '-$ 1,234,567.90',
      'US$ 1,000.00',
      '-$ 5.00',
    ]);
  });

  it('marks debts as negative unless the tone is neutral', () => {
    const [debt, positive, neutral] = amounts();
    expect(debt.classList).toContain('negative');
    expect(positive.classList).not.toContain('negative');
    expect(neutral.classList).not.toContain('negative');
  });

  it('follows the user number format', async () => {
    format.set({ numberFormat: 'dot_comma', showDecimals: false });
    await fixture.whenStable();
    expect(amounts()[0].textContent?.trim()).toBe('-$ 1.234.568');
  });
});
