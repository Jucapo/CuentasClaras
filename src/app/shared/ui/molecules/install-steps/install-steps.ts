import { Component, input, output } from '@angular/core';
import { InstallPlatform } from '../../../../domain/pwa/install-platform';
import { Button } from '../../atoms/button/button';
import { Icon } from '../../atoms/icon/icon';

/**
 * How to install the app and sign in afterwards (spec §3.3). On iPhone the installed app does not
 * share Safari's session, so it always ends with "entra con tu correo y contraseña".
 */
@Component({
  selector: 'cc-install-steps',
  imports: [Icon, Button],
  templateUrl: './install-steps.html',
  styleUrl: './install-steps.scss',
})
export class InstallSteps {
  readonly platform = input.required<InstallPlatform>();
  /** The email to sign in with. */
  readonly email = input.required<string>();
  /** The browser offers its install prompt (Android and desktop Chromium). */
  readonly canPrompt = input(false);
  readonly install = output<void>();
}
