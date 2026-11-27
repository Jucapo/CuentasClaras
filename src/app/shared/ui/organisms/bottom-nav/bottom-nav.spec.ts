import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavLink } from '../../molecules/nav-item/nav-item';
import { BottomNav } from './bottom-nav';

@Component({
  imports: [BottomNav],
  template: `<cc-bottom-nav label="Navegación principal" [items]="items" />`,
})
class Host {
  readonly items: readonly NavLink[] = [
    { path: 'cuentas', label: 'Cuentas', icon: 'account_balance_wallet' },
    { path: 'resumen', label: 'Resumen', icon: 'bar_chart' },
  ];
}

describe('BottomNav', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('is a named navigation landmark with one link per item, in order', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegación principal');
    const links = Array.from(element.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/cuentas', '/resumen']);
    expect(links.map((link) => link.querySelector('cc-icon')?.getAttribute('data-icon'))).toEqual([
      'account_balance_wallet',
      'bar_chart',
    ]);
    expect(links.map((link) => link.querySelector('.nav-label')?.textContent?.trim())).toEqual([
      'Cuentas',
      'Resumen',
    ]);
  });
});
