import { Component, inject, signal } from '@angular/core';
import { apply, form, FormField } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { TextField } from '../../../shared/ui/atoms/text-field/text-field';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { emailSchema } from '../auth-validation';

/** Requests the password reset email. */
@Component({
  selector: 'app-forgot-password-page',
  imports: [FormField, PageHeader, Form, FormActions, TextField, Button, Message],
  templateUrl: './forgot-password-page.html',
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
