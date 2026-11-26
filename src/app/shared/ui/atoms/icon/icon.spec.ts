import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Icon } from './icon';

@Component({
  imports: [Icon],
  template: `
    <cc-icon name="savings" />
    <cc-icon name="warning" size="lg" label="Presupuesto excedido" />
  `,
})
class Host {}

describe('Icon', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function icons(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('cc-icon'));
  }

  it('is decorative by default', () => {
    const [decorative] = icons();
    expect(decorative.getAttribute('aria-hidden')).toBe('true');
    expect(decorative.getAttribute('role')).toBeNull();
    expect(decorative.textContent?.trim()).toBe('savings');
    expect(decorative.classList).toContain('size-md');
  });

  it('becomes an image with an accessible name when labelled', () => {
    const [, labelled] = icons();
    expect(labelled.getAttribute('role')).toBe('img');
    expect(labelled.getAttribute('aria-label')).toBe('Presupuesto excedido');
    expect(labelled.getAttribute('aria-hidden')).toBeNull();
    expect(labelled.classList).toContain('size-lg');
  });
});
