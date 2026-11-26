import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { DateField } from './date-field';

@Component({
  imports: [DateField, FormField],
  template: `<cc-date-field label="Fecha del saldo" maxDate="2026-12-31" [formField]="f.date" />`,
})
class Host {
  readonly model = signal({ date: '2026-11-26' });
  readonly f = form(this.model);
}

describe('DateField', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function input(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  }

  it('is a native date input with the local date as value', () => {
    expect(input().type).toBe('date');
    expect(input().value).toBe('2026-11-26');
    expect(input().getAttribute('max')).toBe('2026-12-31');
  });

  it('writes the picked day as YYYY-MM-DD, without time zone conversion', async () => {
    input().value = '2026-01-01';
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.model().date).toBe('2026-01-01');
  });
});
