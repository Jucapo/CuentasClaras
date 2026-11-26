import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthLayout } from './auth-layout';

@Component({
  imports: [AuthLayout],
  template: `<cc-auth-layout><p class="page">Iniciar sesión</p></cc-auth-layout>`,
})
class Host {}

describe('AuthLayout', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('shows the brand above the projected screen', () => {
    const card = (fixture.nativeElement as HTMLElement).querySelector('main .auth-card');
    expect(card?.querySelector('cc-brand')?.textContent).toContain('Cuentas Claras');
    expect(card?.querySelector('.page')?.textContent).toBe('Iniciar sesión');
  });
});
