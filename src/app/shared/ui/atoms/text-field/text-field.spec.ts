import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { TextField } from './text-field';

@Component({
  imports: [TextField, FormField],
  template: `<cc-text-field
    label="Correo"
    type="email"
    hint="El de tu banco"
    [formField]="f.email"
  />`,
})
class Host {
  readonly locked = signal(false);
  readonly model = signal({ email: '' });
  readonly f = form(this.model, (path) => {
    required(path.email, { message: 'Ingresa tu correo.' });
    disabled(path.email, () => this.locked());
  });
}

describe('TextField', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function input(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  }

  function text(selector: string): string | undefined {
    return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();
  }

  it('labels the native input', () => {
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');
    expect(label?.textContent).toContain('Correo');
    expect(label?.getAttribute('for')).toBe(input().id);
    expect(input().type).toBe('email');
  });

  it('keeps the input and the form model in sync', async () => {
    input().value = 'ana@example.com';
    input().dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.model().email).toBe('ana@example.com');

    fixture.componentInstance.model.set({ email: 'beto@example.com' });
    await fixture.whenStable();
    expect(input().value).toBe('beto@example.com');
  });

  it('shows the hint until the field is left invalid, then the first error', async () => {
    expect(text('mat-hint')).toBe('El de tu banco');
    expect(text('mat-error')).toBeUndefined();

    input().dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(text('mat-error')).toBe('Ingresa tu correo.');
    expect(text('mat-hint')).toBeUndefined();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('mat-form-field')?.classList,
    ).toContain('mat-form-field-invalid');
  });

  it('follows the disabled state of the field', async () => {
    fixture.componentInstance.locked.set(true);
    await fixture.whenStable();
    expect(input().disabled).toBe(true);
  });
});
