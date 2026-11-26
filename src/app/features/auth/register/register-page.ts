import { Component, inject, signal } from '@angular/core';
import {
  apply,
  form,
  FormField,
  FormRoot,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { PASSWORD_MIN_LENGTH } from '../../../core/auth/auth.constants';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { AUTH_VALIDATION_MESSAGES, emailSchema, matchesPassword } from '../auth-validation';

/** Account sign-up; only routed while public sign-up is enabled. */
@Component({
  selector: 'app-register-page',
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    MatButton,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatProgressSpinner,
  ],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);

  protected readonly paths = APP_PATHS;
  protected readonly sentTo = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly model = signal({ email: '', password: '', confirmPassword: '' });

  protected readonly registerForm = form(
    this.model,
    (path) => {
      apply(path.email, emailSchema);
      required(path.password, { message: AUTH_VALIDATION_MESSAGES.newPasswordRequired });
      minLength(path.password, PASSWORD_MIN_LENGTH, {
        message: AUTH_VALIDATION_MESSAGES.passwordTooShort,
      });
      required(path.confirmPassword, {
        message: AUTH_VALIDATION_MESSAGES.confirmPasswordRequired,
      });
      validate(
        path.confirmPassword,
        matchesPassword(() => this.model().password),
      );
    },
    {
      submission: {
        action: async () => {
          this.errorMessage.set(null);
          const email = this.model().email.trim();
          const result = await this.auth.signUp(email, this.model().password);
          if (result.ok) {
            this.sentTo.set(email);
          } else {
            this.errorMessage.set(result.message);
          }
        },
      },
    },
  );
}
