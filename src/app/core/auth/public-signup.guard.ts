import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { FEATURE_FLAGS } from '../config/feature-flags';

/** Only matches the sign-up route while public sign-up is enabled. */
export const publicSignupGuard: CanMatchFn = () => inject(FEATURE_FLAGS).publicSignup;
