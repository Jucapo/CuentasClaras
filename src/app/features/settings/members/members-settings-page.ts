import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { MEMBER_ROLE_LABELS } from '../../../core/config/member.constants';
import { InvitationsService } from '../../../core/invitations/invitations.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { SpaceMembersService } from '../../../core/spaces/space-members.service';
import { SpaceService } from '../../../core/spaces/space.service';
import { todayIsoDate } from '../../../domain/dates/local-date';
import { canChangeRole, canLeave } from '../../../domain/members/member-rules';
import { longDateText } from '../../../domain/periods/period-labels';
import { Button } from '../../../shared/ui/atoms/button/button';
import { IconButton } from '../../../shared/ui/atoms/icon-button/icon-button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../../shared/ui/molecules/section/section';
import {
  InvitationList,
  InvitationListEntry,
} from '../../../shared/ui/organisms/invitation-list/invitation-list';
import { MemberList, MemberListEntry } from '../../../shared/ui/organisms/member-list/member-list';
import { useShortcuts } from '../../../shared/ui/services/keyboard-shortcuts';
import { MemberFlow } from './member-flow';

/**
 * Configuración → Miembros (spec §7): who is in the space and with what role, the pending
 * invitations (owner) and leaving the space (anyone).
 */
@Component({
  selector: 'app-members-settings-page',
  imports: [PageHeader, IconButton, Button, Message, Section, MemberList, InvitationList],
  templateUrl: './members-settings-page.html',
  styleUrl: './members-settings-page.scss',
})
export class MembersSettingsPage {
  private readonly auth = inject(AuthService);
  private readonly members = inject(SpaceMembersService);
  private readonly invitations = inject(InvitationsService);
  private readonly spaces = inject(SpaceService);
  private readonly flow = inject(MemberFlow);

  protected readonly backLink = ['/', APP_PATHS.settings];
  protected readonly canConfigure = this.spaces.canConfigure;
  protected readonly spaceName = computed(() => this.spaces.activeSpace()?.name ?? '');
  protected readonly loadError = computed(
    () => this.members.loadError() ?? this.invitations.pendingLoadError(),
  );

  private readonly me = computed(() => {
    const userId = this.auth.user()?.id;
    return this.members.members().find((member) => member.userId === userId) ?? null;
  });

  protected readonly memberEntries = computed<readonly MemberListEntry[]>(() =>
    this.members.members().map((member) => ({
      userId: member.userId,
      name: member.displayName,
      email: member.email,
      roleLabel: MEMBER_ROLE_LABELS[member.role],
      isMe: member.userId === this.me()?.userId,
      manageable: canChangeRole(this.me(), member),
    })),
  );
  protected readonly membersTitle = computed(() => `Miembros (${this.memberEntries().length})`);
  protected readonly membersDescription = computed(() =>
    this.canConfigure()
      ? 'Toca a alguien para cambiar su rol.'
      : 'Solo el propietario invita, cambia roles y quita miembros.',
  );

  protected readonly invitationEntries = computed<readonly InvitationListEntry[]>(() => {
    const now = new Date();
    const today = todayIsoDate(now);
    return this.invitations.pending().map((invitation) => {
      const expiresAt = new Date(invitation.expiresAt);
      const expired = expiresAt <= now;
      return {
        id: invitation.id,
        email: invitation.email,
        roleLabel: MEMBER_ROLE_LABELS[invitation.role],
        statusLabel: expired
          ? 'Venció: reenvíala'
          : `Vence el ${longDateText(todayIsoDate(expiresAt), today)}`,
        expired,
      };
    });
  });

  protected readonly canLeave = computed(() => {
    const me = this.me();
    return me !== null && canLeave(this.members.members(), me.userId);
  });
  protected readonly leaveDescription = computed(() =>
    this.canLeave() || !this.me()
      ? 'Dejas de ver el espacio. Lo registrado en cuentas compartidas se queda.'
      : 'Eres el único propietario: para salir, haz propietario antes a otra persona.',
  );

  constructor() {
    useShortcuts({ n: () => void this.invite() });
  }

  protected invite(): Promise<void> {
    return this.flow.invite();
  }

  protected openRole(userId: string): void {
    const member = this.members.members().find((m) => m.userId === userId);
    if (member) {
      void this.flow.changeRole(member);
    }
  }

  protected remove(userId: string): void {
    const member = this.members.members().find((m) => m.userId === userId);
    if (member) {
      void this.flow.remove(member);
    }
  }

  protected resend(id: string): void {
    const invitation = this.invitations.pending().find((i) => i.id === id);
    if (invitation) {
      void this.flow.resend(invitation);
    }
  }

  protected revoke(id: string): void {
    const invitation = this.invitations.pending().find((i) => i.id === id);
    if (invitation) {
      void this.flow.revoke(invitation);
    }
  }

  protected leave(): Promise<void> {
    return this.flow.leave();
  }
}
