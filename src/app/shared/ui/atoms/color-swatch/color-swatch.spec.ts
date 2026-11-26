import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { paletteColor } from '../../colors/color-palette';
import { ColorSwatch } from './color-swatch';

@Component({
  imports: [ColorSwatch],
  template: `
    <cc-color-swatch color="teal" label="Verde azulado" [selected]="true" />
    <cc-color-swatch [color]="null" label="Igual que la categoría" />
    <cc-color-swatch color="red" label="Rojo" [decorative]="true" [small]="true" />
  `,
})
class Host {}

describe('ColorSwatch', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function swatches(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('cc-color-swatch'));
  }

  it('is a named toggle button that shows a check when selected', () => {
    const button = swatches()[0].querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Verde azulado');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.querySelector('cc-icon')?.getAttribute('data-icon')).toBe('check');
    expect(swatches()[0].style.getPropertyValue('--cc-swatch-color')).toBe(paletteColor('teal'));
  });

  it('shows the inherit option without a color of its own', () => {
    const button = swatches()[1].querySelector('button');
    expect(button?.classList).toContain('inherits');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(button?.querySelector('cc-icon')?.getAttribute('data-icon')).toBe('format_color_reset');
  });

  it('can be a plain dot next to a label', () => {
    expect(swatches()[2].querySelector('button')).toBeNull();
    expect(swatches()[2].querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
  });
});
