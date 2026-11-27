import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ScreenAction } from '../../services/screen-chrome';
import { AppShell } from './app-shell';

@Component({
  imports: [AppShell, ScreenAction],
  template: `
    <cc-app-shell
      navLabel="Navegación principal"
      totalLabel="Total"
      total="$ 1,000"
      periodLabel="Periodo"
      menuLabel="Abrir el menú"
      userName="Juan Camilo"
      [navItems]="[{ path: 'cuentas', label: 'Cuentas', icon: 'account_balance_wallet' }]"
      (menuOpened)="menus = menus + 1"
    >
      <button ccShellPeriod type="button">Este mes</button>
      <ng-template ccScreenAction><button type="button">Editar</button></ng-template>
      <p class="page">Contenido</p>
    </cc-app-shell>
  `,
})
class Host {
  menus = 0;
}

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

  it('shows the total, the period, the screen action and the content', () => {
    expect(element().querySelector('.total')?.textContent).toContain('$ 1,000');
    expect(
      element().querySelector('[role="group"][aria-label="Periodo"] button')?.textContent,
    ).toBe('Este mes');
    expect(element().querySelector('header .actions button')?.textContent).toBe('Editar');
    expect(element().querySelector('main .page')?.textContent).toBe('Contenido');
  });

  // Spec §7: the avatar opens the menu; settings are no longer in the header.
  it('opens the menu from the avatar', async () => {
    const avatar = element().querySelector<HTMLButtonElement>(
      'header button[aria-label="Abrir el menú"]',
    );
    expect(avatar?.textContent?.trim()).toBe('JC');
    avatar?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.menus).toBe(1);
  });

  it('renders the bottom navigation', () => {
    expect(element().querySelector('nav a')?.getAttribute('href')).toBe('/cuentas');
  });
});
