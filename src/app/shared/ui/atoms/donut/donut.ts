import { Component } from '@angular/core';
import { DONUT_GEOMETRY } from '../../ui.constants';

/**
 * The ring at the center of the categories screen (spec §7), drawn in SVG, with the projected
 * content in its middle. For now it shows only the empty track; segments arrive in F1d.
 */
@Component({
  selector: 'cc-donut',
  templateUrl: './donut.html',
  styleUrl: './donut.scss',
})
export class Donut {
  protected readonly geometry = DONUT_GEOMETRY;
}
