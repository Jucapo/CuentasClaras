import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

/** App-wide configuration of the design system's Material building blocks. */
export function provideUi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    // TODO: switch to self-hosted Material Symbols Rounded with the icon catalog (F1b).
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ]);
}
