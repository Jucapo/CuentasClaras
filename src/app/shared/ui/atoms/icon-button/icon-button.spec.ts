import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IconButton } from './icon-button';

@Component({
  imports: [IconButton],
  template: `
    <cc-icon-button icon="chevron_left" label="Periodo anterior" [disabled]="true" />
    <cc-icon-button icon="settings" label="Configuración" [link]="['/', 'configuracion']" />
  `,
})
class Host {}

describe('IconButton', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('names an icon-only button with its label', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Periodo anterior');
    expect(button?.disabled).toBe(true);
    expect(button?.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a named link when it gets router commands', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('aria-label')).toBe('Configuración');
    expect(link?.getAttribute('href')).toBe('/configuracion');
  });
});
