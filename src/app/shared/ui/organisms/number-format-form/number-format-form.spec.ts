import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { NumberFormatForm, NumberFormatPreferences } from './number-format-form';

@Component({
  imports: [NumberFormatForm],
  template: `<cc-number-format-form [fields]="f.format" />`,
})
class Host {
  readonly model = signal<{ format: NumberFormatPreferences }>({
    format: { numberFormat: 'dot_comma', showDecimals: true },
  });
  readonly f = form(this.model);
}

describe('NumberFormatForm', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function selected(): string | undefined {
    return (fixture.nativeElement as HTMLElement)
      .querySelector('.mat-mdc-select-trigger')
      ?.textContent?.trim();
  }

  it('previews the selected format with a sample amount', () => {
    expect(selected()).toBe('-$ 1.234.567,90');
  });

  it('updates the preview when decimals are turned off', async () => {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[role="switch"]')
      ?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().format.showDecimals).toBe(false);
    expect(selected()).toBe('-$ 1.234.568');
  });
});
