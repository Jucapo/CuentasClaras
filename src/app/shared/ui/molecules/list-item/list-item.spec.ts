import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountRow } from '../account-row/account-row';
import { ListItem } from './list-item';

@Component({
  imports: [ListItem, AccountRow],
  template: `
    <cc-list-item
      title="Etiquetas"
      subtitle="2 activas"
      [link]="['/', 'configuracion', 'etiquetas']"
    >
      <span ccListItemTrailing>2</span>
    </cc-list-item>
    <cc-list-item title="Archivada" [muted]="true">
      <button ccListItemStart type="button">Mover</button>
    </cc-list-item>
    <cc-account-row
      name="Tarjeta"
      icon="credit_card"
      color="red"
      currency="COP"
      notes="Privada"
      [balance]="-50000"
      [link]="['/', 'cuentas', 'a1']"
    />
  `,
})
class Host {}

describe('ListItem', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function items(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('cc-list-item'));
  }

  it('navigates when it has a link and shows title, subtitle and trailing content', () => {
    const link = items()[0].querySelector('a');
    expect(link?.getAttribute('href')).toBe('/configuracion/etiquetas');
    expect(link?.querySelector('.title')?.textContent).toBe('Etiquetas');
    expect(link?.querySelector('.subtitle')?.textContent).toBe('2 activas');
    expect(link?.querySelector('.trailing')?.textContent).toBe('2');
  });

  it('keeps start controls outside the row content and can be muted', () => {
    const [, archived] = items();
    expect(archived.querySelector('a')).toBeNull();
    expect(archived.classList).toContain('muted');
    expect(archived.firstElementChild?.tagName).toBe('BUTTON');
  });

  it('shows an account with its badge, notes and colored balance', () => {
    const row = (fixture.nativeElement as HTMLElement).querySelector('cc-account-row');
    expect(row?.getAttribute('role')).toBe('listitem');
    expect(row?.querySelector('a')?.getAttribute('href')).toBe('/cuentas/a1');
    expect(row?.querySelector('cc-icon-badge cc-icon')?.getAttribute('data-icon')).toBe(
      'credit_card',
    );
    expect(row?.querySelector('.subtitle')?.textContent).toBe('Privada');
    expect(row?.querySelector('cc-amount')?.textContent?.trim()).toBe('-$ 500.00');
    expect(row?.querySelector('cc-amount')?.classList).toContain('negative');
  });
});
