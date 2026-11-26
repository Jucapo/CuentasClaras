import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { iconGlyph } from '../../icons/icon-glyphs';
import { Button } from './button';

@Component({
  imports: [Button],
  template: `
    <cc-button
      type="submit"
      icon="save"
      loadingLabel="Guardando"
      [loading]="loading()"
      [disabled]="disabled()"
      (click)="clicks = clicks + 1"
      >Guardar</cc-button
    >
    <cc-button variant="text" [link]="['/', 'cuentas']">Ver cuentas</cc-button>
  `,
})
class Host {
  readonly loading = signal(false);
  readonly disabled = signal(false);
  clicks = 0;
}

describe('Button', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function button(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
  }

  it('renders a native button with its type, icon and label', () => {
    expect(button().type).toBe('submit');
    expect(button().textContent).toContain('Guardar');
    expect(button().querySelector('mat-icon')?.getAttribute('data-icon')).toBe('save');
    expect(button().querySelector('mat-icon')?.textContent).toBe(iconGlyph('save'));
  });

  it('reports clicks on the host', () => {
    button().click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });

  it('blocks clicks and announces the busy state while loading', async () => {
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().querySelector('mat-progress-spinner')?.getAttribute('aria-label')).toBe(
      'Guardando',
    );
  });

  it('can be disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    expect(button().disabled).toBe(true);
  });

  it('renders a link when it gets router commands', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/cuentas');
    expect(link?.textContent).toContain('Ver cuentas');
  });
});
