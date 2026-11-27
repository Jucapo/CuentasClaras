import { Component, computed, input } from '@angular/core';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';

/** Who invites the user to which space, and with what role (spec §3.3). */
@Component({
  selector: 'cc-invitation-card',
  imports: [IconBadge],
  templateUrl: './invitation-card.html',
  styleUrl: './invitation-card.scss',
})
export class InvitationCard {
  readonly spaceName = input.required<string>();
  readonly spaceIcon = input.required<string>();
  readonly spaceColor = input.required<string | null>();
  readonly inviterName = input<string | null>(null);
  readonly roleLabel = input.required<string>();

  protected readonly headline = computed(() => {
    const inviter = this.inviterName();
    return `${inviter ? `${inviter} te invitó` : 'Te invitaron'} a «${this.spaceName()}»`;
  });
}
