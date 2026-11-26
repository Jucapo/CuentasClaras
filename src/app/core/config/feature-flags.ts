import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Environment } from '../../../environments/environment.model';

/** Feature flags for the current build; injectable so tests can override them. */
export const FEATURE_FLAGS = new InjectionToken<Environment['features']>('FEATURE_FLAGS', {
  providedIn: 'root',
  factory: () => environment.features,
});
