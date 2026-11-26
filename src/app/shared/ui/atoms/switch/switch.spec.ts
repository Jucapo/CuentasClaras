import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { Switch } from './switch';

@Component({
  imports: [Switch, FormField],
  template: `<cc-switch
    label="Mostrar decimales"
    hint="-$ 1,234.90"
    [formField]="f.showDecimals"
  />`,
})
class Host {
  readonly model = signal({ showDecimals: true });
  readonly f = form(this.model);
}

describe('Switch', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function control(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'button[role="switch"]',
    ) as HTMLButtonElement;
  }

  it('reflects the field value and describes it with the hint', () => {
    expect(control().getAttribute('aria-checked')).toBe('true');
    const hint = (fixture.nativeElement as HTMLElement).querySelector('.supporting-text');
    expect(hint?.textContent?.trim()).toBe('-$ 1,234.90');
    expect(control().getAttribute('aria-describedby')).toContain(hint?.id ?? 'missing');
  });

  it('is labelled', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mostrar decimales');
  });

  it('writes the toggled value to the form', async () => {
    control().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.model().showDecimals).toBe(false);
  });
});
