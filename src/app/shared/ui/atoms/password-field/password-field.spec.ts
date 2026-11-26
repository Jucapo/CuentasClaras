import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { PasswordField } from './password-field';

@Component({
  imports: [PasswordField, FormField],
  template: `<cc-password-field
    label="Contraseña"
    autocomplete="new-password"
    [formField]="f.password"
  />`,
})
class Host {
  readonly model = signal({ password: '' });
  readonly f = form(this.model, (path) => {
    required(path.password, { message: 'Ingresa una contraseña.' });
  });
}

describe('PasswordField', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function input(): HTMLInputElement {
    return element().querySelector('input') as HTMLInputElement;
  }

  function toggle(): HTMLButtonElement {
    return element().querySelector('button') as HTMLButtonElement;
  }

  it('hides the password and offers to show it', () => {
    expect(input().type).toBe('password');
    expect(input().getAttribute('autocomplete')).toBe('new-password');
    expect(toggle().getAttribute('aria-label')).toBe('Mostrar contraseña');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('reveals and hides the password with the toggle', async () => {
    toggle().click();
    await fixture.whenStable();
    expect(input().type).toBe('text');
    expect(toggle().getAttribute('aria-label')).toBe('Ocultar contraseña');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');

    toggle().click();
    await fixture.whenStable();
    expect(input().type).toBe('password');
  });

  it('writes what the user types to the form', () => {
    input().value = 'secreto-123';
    input().dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.model().password).toBe('secreto-123');
  });

  it('shows the error after the field is left empty', async () => {
    input().dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(element().querySelector('mat-error')?.textContent?.trim()).toBe(
      'Ingresa una contraseña.',
    );
  });
});
