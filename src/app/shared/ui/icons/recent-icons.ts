import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Icons used recently in the active space, newest first, for the "Sugeridos" section of the icon
 * picker (spec §13.3). The picker reads it instead of a data service; the app binds it to the
 * space's accounts and categories, and the catalog and tests get none.
 */
export const RECENT_ICONS = new InjectionToken<Signal<readonly string[]>>('RECENT_ICONS', {
  factory: () => signal<readonly string[]>([]).asReadonly(),
});
