import { Component, inject, input, signal } from '@angular/core';
import { apply, form, FormField, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { FEATURE_FLAGS } from '../../../core/config/feature-flags';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { Button } from '../../../shared/ui/atoms/button/button';
import { PasswordField } from '../../../shared/ui/atoms/password-field/password-field';
import { TextField } from '../../../shared/ui/atoms/text-field/text-field';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { AUTH_VALIDATION_MESSAGES, emailSchema } from '../auth-validation';

/** Email and password sign-in. */
@Component({
  selector: 'app-login-page',
  imports: [FormField, PageHeader, Form, FormActions, TextField, PasswordField, Button],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Internal URL to return to after signing in (bound from the `redirect` query param). */
  readonly redirect = input<string>();

  protected readonly paths = APP_PATHS;
  protected readonly publicSignup = inject(FEATURE_FLAGS).publicSignup;
  protected readonly errorMessage = signal<string | null>(null);

  private readonly model = signal({ email: '', password: '' });

  protected readonly loginForm = form(
    this.model,
    (path) => {
      apply(path.email, emailSchema);
      required(path.password, { message: AUTH_VALIDATION_MESSAGES.passwordRequired });
    },
    {
      submission: {
        action: async () => {
          this.errorMessage.set(null);
          const { email, password } = this.model();
          const result = await this.auth.signIn(email.trim(), password);
          if (!result.ok) {
            this.errorMessage.set(result.message);
            return;
          }
          await this.router.navigateByUrl(this.safeRedirect());
        },
      },
    },
  );

  private safeRedirect(): string {
    const target = this.redirect();
    return target?.startsWith('/') && !target.startsWith('//') ? target : '/';
  }
}
