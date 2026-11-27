import { Component, computed, input } from '@angular/core';
import { colorOrFallback, paletteColor } from '../../colors/color-palette';
import { DONUT_GEOMETRY } from '../../ui.constants';

/** A slice of the ring: a value and its palette color. */
export interface DonutSegment {
  readonly value: number;
  readonly color: string | null;
}

interface Arc {
  readonly dasharray: string;
  readonly dashoffset: number;
  readonly color: string;
}

/**
 * The ring at the center of the categories screen (spec §7), drawn in SVG and split into one
 * segment per category, with the projected content in its middle. Without values it shows the
 * empty track.
 */
@Component({
  selector: 'cc-donut',
  templateUrl: './donut.html',
  styleUrl: './donut.scss',
})
export class Donut {
  /** Segments clockwise from the top; zero and negative values are left out. */
  readonly segments = input<readonly DonutSegment[]>([]);

  protected readonly geometry = DONUT_GEOMETRY;

  protected readonly arcs = computed<Arc[]>(() => {
    const visible = this.segments().filter((segment) => segment.value > 0);
    const total = visible.reduce((sum, segment) => sum + segment.value, 0);
    if (total <= 0) {
      return [];
    }
    const circumference = 2 * Math.PI * this.geometry.radius;
    const gap = visible.length > 1 ? this.geometry.segmentGap : 0;
    let start = 0;
    return visible.map((segment) => {
      const length = (segment.value / total) * circumference;
      const drawn = Math.max(length - gap, 0);
      const arc = {
        dasharray: `${drawn} ${circumference - drawn}`,
        dashoffset: -start,
        color: paletteColor(colorOrFallback(segment.color)),
      };
      start += length;
      return arc;
    });
  });
}
