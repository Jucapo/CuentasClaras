import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { APP_LOGO_PATH, APP_NAME } from '../../../../core/config/app.constants';

/**
 * Product logo and name. With `lead` it is the title of its screen in one line, e.g. "Únete a"
 * followed by the logo and "Cuentas Claras" (spec §7, /invitacion); `heading` makes it the h1.
 */
@Component({
  selector: 'cc-brand',
  imports: [NgTemplateOutlet],
  templateUrl: './brand.html',
  styleUrl: './brand.scss',
})
export class Brand {
  protected readonly name = APP_NAME;
  protected readonly logo = APP_LOGO_PATH;

  /** Words before the logo, e.g. "Únete a". */
  readonly lead = input<string | null>(null);
  /** The line is the screen's main heading. */
  readonly heading = input(false);
}
