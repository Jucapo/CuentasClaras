import { Component, inject, signal } from '@angular/core';
import { apply, form, FormField, FormRoot } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { emailSchema } from '../auth-validation';

/** Requests the password reset email. */
@Component({
  selector: 'app-forgot-password-page',
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
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);

  protected readonly paths = APP_PATHS;
  protected readonly sentTo = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly model = signal({ email: '' });

  protected readonly forgotForm = form(
    this.model,
    (path) => {
      apply(path.email, emailSchema);
    },
    {
      submission: {
        action: async () => {
          this.errorMessage.set(null);
          const email = this.model().email.trim();
          const result = await this.auth.sendPasswordReset(email);
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
