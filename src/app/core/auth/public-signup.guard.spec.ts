import { TestBed } from '@angular/core/testing';
import { PartialMatchRouteSnapshot, Route } from '@angular/router';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { publicSignupGuard } from './public-signup.guard';

describe('publicSignupGuard', () => {
  function runGuard(publicSignup: boolean) {
    TestBed.configureTestingModule({
      providers: [{ provide: FEATURE_FLAGS, useValue: { publicSignup } }],
    });
    return TestBed.runInInjectionContext(() =>
      publicSignupGuard({} as Route, [], {} as PartialMatchRouteSnapshot),
    );
  }

  it('hides the sign-up route while public sign-up is closed', () => {
    expect(runGuard(false)).toBe(false);
  });

  it('matches the sign-up route when public sign-up is open', () => {
    expect(runGuard(true)).toBe(true);
  });
});
