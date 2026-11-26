import { Component, input } from '@angular/core';
import { Message } from '../../atoms/message/message';

/** `stretch` fills the width (mobile-first forms); `end` aligns actions to the right. */
export type FormActionsAlign = 'stretch' | 'end';

/**
 * Submit area of a form: the error message, the main actions (default slot) and secondary
 * links (`[ccSecondaryAction]`).
 */
@Component({
  selector: 'cc-form-actions',
  imports: [Message],
  templateUrl: './form-actions.html',
  styleUrl: './form-actions.scss',
  host: { '[class]': "'align-' + align()" },
})
export class FormActions {
  readonly error = input<string | null>(null);
  readonly align = input<FormActionsAlign>('stretch');
}
