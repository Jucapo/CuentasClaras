import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  DEFAULT_INVITE_ROLE,
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLES,
} from '../../../core/config/member.constants';
import { InvitationDelivery, PendingInvitation } from '../../../core/invitations/invitation.models';
import { InvitationsService } from '../../../core/invitations/invitations.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { SpaceMembersService } from '../../../core/spaces/space-members.service';
import { MemberRole, SpaceMember } from '../../../core/spaces/space.models';
import { SpaceService } from '../../../core/spaces/space.service';
import { OptionPanel, OptionPanelData } from '../../../shared/ui/molecules/option-panel/option-panel';
import {
  InviteRoleOption,
  InviteSheet,
  InviteSheetData,
} from '../../../shared/ui/organisms/invite-sheet/invite-sheet';
import { ConfirmService } from '../../../shared/ui/services/confirm.service';
import { OverlayService } from '../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../shared/ui/services/toast.service';

/** The roles an invitation or a member can have, with what each allows. */
const ROLE_OPTIONS: readonly InviteRoleOption[] = MEMBER_ROLES.map((role) => ({
  value: role,
  label: MEMBER_ROLE_LABELS[role],
  description: MEMBER_ROLE_DESCRIPTIONS[role],
}));

/** What happens with the data of whoever leaves (spec §3.2), as the confirmations explain it. */
const LEAVING_DATA_NOTE =
  'Lo registrado en cuentas compartidas se queda en el espacio. Las cuentas privadas quedan ocultas para todos y vuelven si regresa al espacio.';

/**
 * Configuración → Miembros (spec §7): inviting, resending and revoking (owner), changing roles and
 * removing members (owner), and leaving the space (anyone). Sheets return their intent and the
 * confirmations happen here (spec §13.5).
 */
@Injectable({ providedIn: 'root' })
export class MemberFlow {
  private readonly members = inject(SpaceMembersService);
  private readonly invitations = inject(InvitationsService);
  private readonly spaces = inject(SpaceService);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Opens the invite sheet; a new account gets the email, an existing one the link. */
  async invite(): Promise<void> {
    if (!this.spaces.canConfigure()) {
      return;
    }
    const result = await this.overlay.open<InvitationDelivery, InviteSheetData>(InviteSheet, {
      label: 'Invitar',
      autoFocus: 'input',
      data: {
        spaceName: this.spaceName(),
        roles: ROLE_OPTIONS,
        defaultRole: DEFAULT_INVITE_ROLE,
        invite: (email, role) => this.invitations.invite(email, role),
      },
    });
    if (result?.kind === 'email') {
      void this.toast.show(`Invitación enviada a ${result.email}.`);
    }
  }

  /** Resends an invitation: a new email, or a new link to copy for an existing account. */
  async resend(invitation: PendingInvitation): Promise<void> {
    const result = await this.invitations.resend(invitation.id);
    if (!result.ok) {
      void this.toast.show(result.message);
      return;
    }
    if (result.value.kind === 'email') {
      void this.toast.show(`Invitación reenviada a ${result.value.email}.`);
      return;
    }
    await this.overlay.open<InvitationDelivery, InviteSheetData>(InviteSheet, {
      label: 'Link de invitación',
      data: {
        spaceName: this.spaceName(),
        roles: ROLE_OPTIONS,
        defaultRole: invitation.role,
        link: { email: result.value.email, link: result.value.link },
        invite: (email, role) => this.invitations.invite(email, role),
      },
    });
  }

  /** Revokes an invitation after confirming; its link stops working. */
  async revoke(invitation: PendingInvitation): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Revocar la invitación de ${invitation.email}?`,
      message: 'El link deja de servir. Puedes invitar a esa persona de nuevo cuando quieras.',
      confirmLabel: 'Revocar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const result = await this.invitations.revoke(invitation.id);
    void this.toast.show(result.ok ? 'Invitación revocada.' : result.message);
  }

  /** Offers the roles for another member; making someone owner asks first. */
  async changeRole(member: SpaceMember): Promise<void> {
    const role = await this.overlay.open<MemberRole, OptionPanelData<MemberRole>>(OptionPanel, {
      label: `Rol de ${member.displayName}`,
      data: {
        title: `Rol de ${member.displayName}`,
        mode: 'single',
        selected: member.role,
        options: ROLE_OPTIONS,
      },
    });
    if (!role || role === member.role) {
      return;
    }
    if (role === 'owner') {
      const confirmed = await this.confirm.confirm({
        title: `¿Hacer propietario a ${member.displayName}?`,
        message:
          'Podrá invitar y quitar miembros, también a ti, y cambiar la configuración del espacio.',
        confirmLabel: 'Hacer propietario',
      });
      if (!confirmed) {
        return;
      }
    }
    const result = await this.members.changeRole(member.userId, role);
    void this.toast.show(
      result.ok
        ? `${member.displayName} ahora es ${MEMBER_ROLE_LABELS[role].toLowerCase()}.`
        : result.message,
    );
  }

  /** Removes another member after confirming what happens with their data (spec §3.2). */
  async remove(member: SpaceMember): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Quitar a ${member.displayName} del espacio?`,
      message: `Deja de ver «${this.spaceName()}». ${LEAVING_DATA_NOTE}`,
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const result = await this.members.remove(member.userId);
    void this.toast.show(
      result.ok ? `${member.displayName} ya no está en el espacio.` : result.message,
    );
  }

  /** Leaves the active space after confirming; then another space, or the setup wizard. */
  async leave(): Promise<void> {
    const spaceName = this.spaceName();
    const confirmed = await this.confirm.confirm({
      title: `¿Salir de ${spaceName}?`,
      message: `Dejas de ver el espacio. ${LEAVING_DATA_NOTE}`,
      confirmLabel: 'Salir',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const result = await this.members.leave();
    if (!result.ok) {
      void this.toast.show(result.message);
      return;
    }
    void this.toast.show(`Saliste de ${spaceName}.`);
    await this.router.navigateByUrl(this.spaces.hasSpace() ? '/' : `/${APP_PATHS.welcome}`);
  }

  private spaceName(): string {
    return this.spaces.activeSpace()?.name ?? '';
  }
}
