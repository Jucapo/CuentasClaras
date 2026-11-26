import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

/** Class of the self-hosted icon font, defined in src/styles/_fonts.scss. */
export const ICON_FONT_CLASS = 'cc-symbols';

/** App-wide configuration of the design system's Material building blocks. */
export function provideUi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: ICON_FONT_CLASS } },
  ]);
}
