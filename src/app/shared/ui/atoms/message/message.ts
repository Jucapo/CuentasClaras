import { Component, input } from '@angular/core';

/** `error` is announced immediately (alert); `info` politely (status). */
export type MessageTone = 'error' | 'info';

/** Short feedback text, such as a form error or a confirmation. */
@Component({
  selector: 'cc-message',
  templateUrl: './message.html',
  styleUrl: './message.scss',
  host: {
    '[class]': "'tone-' + tone()",
    '[attr.role]': "tone() === 'error' ? 'alert' : 'status'",
  },
})
export class Message {
  readonly tone = input<MessageTone>('error');
}
