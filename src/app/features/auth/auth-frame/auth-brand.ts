import { Injectable, signal } from '@angular/core';

/**
 * What the screen inside the auth frame says before the logo, so the logo line is its title, e.g.
 * "Únete a" on the invitation to a new account (spec §7). Null shows the logo alone.
 */
@Injectable({ providedIn: 'root' })
export class AuthBrand {
  readonly lead = signal<string | null>(null);
}
