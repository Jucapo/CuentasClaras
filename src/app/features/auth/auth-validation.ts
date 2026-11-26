import { FieldValidator, required, schema, email } from '@angular/forms/signals';
import { PASSWORD_MIN_LENGTH } from '../../core/auth/auth.constants';

/** Validation messages shared by the auth forms. */
export const AUTH_VALIDATION_MESSAGES = {
  emailRequired: 'Ingresa tu correo.',
  emailInvalid: 'Ingresa un correo válido.',
  passwordRequired: 'Ingresa tu contraseña.',
  newPasswordRequired: 'Ingresa una contraseña.',
  passwordTooShort: `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  confirmPasswordRequired: 'Confirma la contraseña.',
  passwordMismatch: 'Las contraseñas no coinciden.',
} as const;

/** Required, well-formed email. */
export const emailSchema = schema<string>((path) => {
  required(path, { message: AUTH_VALIDATION_MESSAGES.emailRequired });
  email(path, { message: AUTH_VALIDATION_MESSAGES.emailInvalid });
});

/** Fails when the field differs from the given password value. */
export function matchesPassword(password: () => string): FieldValidator<string> {
  return ({ value }) =>
    value() === password()
      ? undefined
      : { kind: 'passwordMismatch', message: AUTH_VALIDATION_MESSAGES.passwordMismatch };
}
