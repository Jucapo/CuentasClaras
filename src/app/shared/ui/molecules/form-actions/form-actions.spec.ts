import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormActions } from './form-actions';

@Component({
  imports: [FormActions],
  template: `
    <cc-form-actions [error]="error()">
      <button type="submit">Entrar</button>
      <a ccSecondaryAction href="/recuperar-contrasena">¿Olvidaste tu contraseña?</a>
    </cc-form-actions>
  `,
})
class Host {
  readonly error = signal<string | null>(null);
}

describe('FormActions', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('places the main action and the secondary links in their areas', () => {
    expect(element().querySelector('.primary button')?.textContent).toBe('Entrar');
    expect(element().querySelector('.secondary a')?.textContent).toBe('¿Olvidaste tu contraseña?');
  });

  it('shows the error as an alert only when there is one', async () => {
    expect(element().querySelector('[role="alert"]')).toBeNull();

    fixture.componentInstance.error.set('Correo o contraseña incorrectos.');
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Correo o contraseña incorrectos.',
    );
  });
});
