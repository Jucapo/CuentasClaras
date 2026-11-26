import { Component, inject, signal } from '@angular/core';
import { form, FormField, minLength, required, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { PASSWORD_MIN_LENGTH } from '../../../core/auth/auth.constants';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { PasswordField } from '../../../shared/ui/atoms/password-field/password-field';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { ToastService } from '../../../shared/ui/services/toast.service';
import { AUTH_VALIDATION_MESSAGES, matchesPassword } from '../auth-validation';

/** Sets a new password from the recovery link (or for the signed-in user). */
@Component({
  selector: 'app-reset-password-page',
  imports: [FormField, PageHeader, Form, FormActions, PasswordField, Button, Message],
  templateUrl: './reset-password-page.html',
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

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
          void this.toast.show('Contraseña actualizada.');
          await this.router.navigateByUrl('/');
        },
      },
    },
  );
}
