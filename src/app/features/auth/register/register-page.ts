import { Component, inject, signal } from '@angular/core';
import { apply, form, FormField, minLength, required, validate } from '@angular/forms/signals';
import { PASSWORD_MIN_LENGTH } from '../../../core/auth/auth.constants';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { PasswordField } from '../../../shared/ui/atoms/password-field/password-field';
import { TextField } from '../../../shared/ui/atoms/text-field/text-field';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { AUTH_VALIDATION_MESSAGES, emailSchema, matchesPassword } from '../auth-validation';

/** Account sign-up; only routed while public sign-up is enabled. */
@Component({
  selector: 'app-register-page',
  imports: [FormField, PageHeader, Form, FormActions, TextField, PasswordField, Button, Message],
  templateUrl: './register-page.html',
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
