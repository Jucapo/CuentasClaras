import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NavItem } from './nav-item';

@Component({
  imports: [NavItem],
  template: `
    <cc-nav-item [link]="['/', 'cuentas']" label="Cuentas" icon="account_balance_wallet" />
    <cc-nav-item [link]="['/', 'resumen']" label="Resumen" icon="bar_chart" />
  `,
})
class Host {}

describe('NavItem', () => {
  it('links to its route and marks it as the current page when active', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'cuentas', component: Host },
          { path: 'resumen', component: Host },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cuentas');

    const links = Array.from(
      (harness.routeNativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a'),
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/cuentas', '/resumen']);
    expect(links.map((link) => link.querySelector('.nav-label')?.textContent)).toEqual([
      'Cuentas',
      'Resumen',
    ]);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[0].classList).toContain('active');
    expect(links[1].getAttribute('aria-current')).toBeNull();
  });
});
