import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, minLength, required, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { PASSWORD_MIN_LENGTH } from '../../../core/auth/auth.constants';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { AUTH_VALIDATION_MESSAGES, matchesPassword } from '../auth-validation';

/** Sets a new password from the recovery link (or for the signed-in user). */
@Component({
  selector: 'app-reset-password-page',
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
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly paths = APP_PATHS;
  protected readonly hasSession = this.auth.isAuthenticated;
  protected readonly errorMessage = signal<string | null>(null);

  private readonly model = signal({ password: '', confirmPassword: '' });

  protected readonly resetForm = form(
    this.model,
    (path) => {
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
          const result = await this.auth.updatePassword(this.model().password);
          if (!result.ok) {
            this.errorMessage.set(result.message);
            return;
          }
          this.snackBar.open('Contraseña actualizada.');
          await this.router.navigateByUrl('/');
        },
      },
    },
  );
}
