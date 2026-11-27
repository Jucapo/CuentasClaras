import { email, maxLength, required, schema } from '@angular/forms/signals';
import { MemberRole } from '../../../../core/spaces/space.models';

/** Longest email; matches the check of `space_invitations.email`. */
export const INVITE_EMAIL_MAX_LENGTH = 254;

/** Values edited by `cc-invite-sheet`. */
export interface InviteFormValue {
  email: string;
  role: MemberRole;
}

/** Validation messages of the invite form. */
export const INVITE_FORM_MESSAGES = {
  emailRequired: 'Escribe el correo de la persona.',
  emailInvalid: 'Escribe un correo válido.',
  emailTooLong: `Usa máximo ${INVITE_EMAIL_MAX_LENGTH} caracteres.`,
} as const;

/** Rules of the invite form. */
export const inviteFormSchema = schema<InviteFormValue>((path) => {
  required(path.email, { message: INVITE_FORM_MESSAGES.emailRequired });
  email(path.email, { message: INVITE_FORM_MESSAGES.emailInvalid });
  maxLength(path.email, INVITE_EMAIL_MAX_LENGTH, { message: INVITE_FORM_MESSAGES.emailTooLong });
});
