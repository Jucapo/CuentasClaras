import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { iconGlyph } from '../../icons/icon-glyphs';
import { Icon } from './icon';

@Component({
  imports: [Icon],
  template: `
    <cc-icon name="savings" />
    <cc-icon name="warning" size="lg" label="Presupuesto excedido" [filled]="true" />
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
    expect(decorative.getAttribute('data-icon')).toBe('savings');
    expect(decorative.textContent?.trim()).toBe(iconGlyph('savings'));
    expect(decorative.classList).toContain('size-md');
    expect(decorative.classList).not.toContain('filled');
  });

  it('can be filled', () => {
    const [, filled] = icons();
    expect(filled.classList).toContain('filled');
  });

  it('becomes an image with an accessible name when labelled', () => {
    const [, labelled] = icons();
    expect(labelled.getAttribute('role')).toBe('img');
    expect(labelled.getAttribute('aria-label')).toBe('Presupuesto excedido');
    expect(labelled.getAttribute('aria-hidden')).toBeNull();
    expect(labelled.classList).toContain('size-lg');
  });
});
