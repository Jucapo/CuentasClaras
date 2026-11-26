import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeader } from './page-header';

@Component({
  imports: [PageHeader],
  template: `
    <cc-page-header title="Iniciar sesión" subtitle="Entra con tu correo.">
      <button type="button">Acción</button>
    </cc-page-header>
  `,
})
class Host {}

describe('PageHeader', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('renders the page heading, the subtitle and the projected actions', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Iniciar sesión');
    expect(element.querySelector('.subtitle')?.textContent).toBe('Entra con tu correo.');
    expect(element.querySelector('button')?.textContent).toBe('Acción');
  });
});
