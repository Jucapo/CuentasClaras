import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShell } from './app-shell';

@Component({
  imports: [AppShell],
  template: `
    <cc-app-shell
      navLabel="Navegación principal"
      totalLabel="Total"
      total="$ 1,000"
      periodLabel="Periodo"
      [navItems]="[{ path: 'cuentas', label: 'Cuentas', icon: 'account_balance_wallet' }]"
    >
      <button ccShellPeriod type="button">Este mes</button>
      <button ccShellActions type="button">Configuración</button>
      <p class="page">Contenido</p>
    </cc-app-shell>
  `,
})
class Host {}

describe('AppShell', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the total and places each slot in the header or the content', () => {
    expect(element().querySelector('.total')?.textContent).toContain('$ 1,000');
    expect(
      element().querySelector('[role="group"][aria-label="Periodo"] button')?.textContent,
    ).toBe('Este mes');
    expect(element().querySelector('header .actions button')?.textContent).toBe('Configuración');
    expect(element().querySelector('main .page')?.textContent).toBe('Contenido');
  });

  it('renders the bottom navigation', () => {
    expect(element().querySelector('nav a')?.getAttribute('href')).toBe('/cuentas');
  });
});
