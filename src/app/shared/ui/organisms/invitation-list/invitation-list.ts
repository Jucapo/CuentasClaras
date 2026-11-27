import { Component, input, output } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { ListItem } from '../../molecules/list-item/list-item';

/** An open invitation as Miembros shows it (spec §7). */
export interface InvitationListEntry {
  readonly id: string;
  readonly email: string;
  readonly roleLabel: string;
  /** "Vence el 4 dic" or, past the date, that it expired. */
  readonly statusLabel: string;
  readonly expired: boolean;
}

/** Open invitations, each with Reenviar and Revocar (owner only). */
@Component({
  selector: 'cc-invitation-list',
  imports: [ListItem, Icon, IconButton],
  templateUrl: './invitation-list.html',
  styleUrl: './invitation-list.scss',
})
export class InvitationList {
  readonly invitations = input.required<readonly InvitationListEntry[]>();
  readonly resendRequested = output<string>();
  readonly revokeRequested = output<string>();
}
