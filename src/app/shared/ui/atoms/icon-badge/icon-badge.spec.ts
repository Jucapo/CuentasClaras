import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FALLBACK_COLOR, paletteColor } from '../../colors/color-palette';
import { FALLBACK_ICON } from '../../icons/icon-glyphs';
import { IconBadge } from './icon-badge';

@Component({
  imports: [IconBadge],
  template: `
    <cc-icon-badge icon="shopping_cart" color="teal" size="lg" label="Mercado" />
    <cc-icon-badge icon="gone_icon" color="gone-color" />
  `,
})
class Host {}

describe('IconBadge', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function badges(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('cc-icon-badge'));
  }

  it('paints a filled icon on the palette color of the theme', () => {
    const [badge] = badges();
    expect(badge.style.getPropertyValue('--cc-badge-color')).toBe(paletteColor('teal'));
    expect(badge.classList).toContain('size-lg');
    const icon = badge.querySelector('cc-icon');
    expect(icon?.getAttribute('data-icon')).toBe('shopping_cart');
    expect(icon?.classList).toContain('filled');
    expect(icon?.getAttribute('aria-label')).toBe('Mercado');
  });

  it('falls back for keys that are no longer in the catalog or the palette', () => {
    const [, stale] = badges();
    expect(stale.querySelector('cc-icon')?.getAttribute('data-icon')).toBe(FALLBACK_ICON);
    expect(stale.style.getPropertyValue('--cc-badge-color')).toBe(paletteColor(FALLBACK_COLOR));
  });
});
