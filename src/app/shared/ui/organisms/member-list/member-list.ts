import { Component, input, output } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { ListItem } from '../../molecules/list-item/list-item';

/** A member as Miembros shows it (spec §7). */
export interface MemberListEntry {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly roleLabel: string;
  /** The signed-in user, marked "(tú)". */
  readonly isMe: boolean;
  /** The viewer can change this member's role and remove them. */
  readonly manageable: boolean;
}

/**
 * Members with their name, email and role. Choosing a manageable member emits `roleRequested`
 * (the page offers the roles), and its trailing button emits `removeRequested`.
 */
@Component({
  selector: 'cc-member-list',
  imports: [ListItem, Icon, IconButton],
  templateUrl: './member-list.html',
  styleUrl: './member-list.scss',
})
export class MemberList {
  readonly members = input.required<readonly MemberListEntry[]>();
  readonly roleRequested = output<string>();
  readonly removeRequested = output<string>();
}
