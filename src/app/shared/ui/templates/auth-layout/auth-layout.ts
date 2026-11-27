import { Component, input } from '@angular/core';
import { Brand } from '../../molecules/brand/brand';

/**
 * Centered card for the sign-in, sign-up and password screens. With `brandLead` the logo line is
 * the screen's title, e.g. "Únete a" + the logo and the name, instead of a title of its own.
 */
@Component({
  selector: 'cc-auth-layout',
  imports: [Brand],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  /** Words before the logo that make it the screen's title. */
  readonly brandLead = input<string | null>(null);
}
