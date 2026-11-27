import { Component, computed, inject, signal } from '@angular/core';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { DataResult } from '../../../../core/action-result';
import { InvitationDelivery } from '../../../../core/invitations/invitation.models';
import { MemberRole } from '../../../../core/spaces/space.models';
import { Button } from '../../atoms/button/button';
import { Message } from '../../atoms/message/message';
import { SegmentedControl, SegmentOption } from '../../atoms/segmented-control/segmented-control';
import { TextField } from '../../atoms/text-field/text-field';
import { Form } from '../../molecules/form/form';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { ShareService } from '../../services/share.service';
import { UI_TEXT } from '../../ui.constants';
import { InviteFormValue, inviteFormSchema } from './invite-sheet.model';

/** A role an invitation can carry, with what it allows. */
export interface InviteRoleOption extends SegmentOption<MemberRole> {
  readonly description: string;
}

/** The link an existing account can open, shown instead of sending an email. */
export interface InviteLink {
  readonly email: string;
  readonly link: string;
}

/** Data of `cc-invite-sheet`. */
export interface InviteSheetData {
  readonly spaceName: string;
  readonly roles: readonly InviteRoleOption[];
  readonly defaultRole: MemberRole;
  /** Opens on the link instead of the form, e.g. after resending to an existing account. */
  readonly link?: InviteLink;
  /** Sends the invitation; the sheet shows the error, the link, or closes. */
  readonly invite: (email: string, role: MemberRole) => Promise<DataResult<InvitationDelivery>>;
}

/**
 * Inviting someone in one sheet (spec §7, Miembros): email and role. A new account gets the email
 * and the sheet closes with it; an existing account gets no email, so the sheet shows the link to
 * copy or share (spec §3.3).
 */
@Component({
  selector: 'cc-invite-sheet',
  imports: [FormField, OverlayPanel, Form, TextField, SegmentedControl, Button, Message],
  templateUrl: './invite-sheet.html',
  styleUrl: './invite-sheet.scss',
})
export class InviteSheet {
  protected readonly data = inject<InviteSheetData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<InvitationDelivery>>(OverlayHandle);
  protected readonly share = inject(ShareService);

  protected readonly text = UI_TEXT;
  protected readonly error = signal<string | null>(null);
  protected readonly link = signal<InviteLink | null>(this.data.link ?? null);
  protected readonly copied = signal(false);

  private readonly model = signal<InviteFormValue>({ email: '', role: this.data.defaultRole });
  protected readonly form = form(this.model, (path) => apply(path, inviteFormSchema), {
    submission: { action: () => this.send() },
  });

  protected readonly roleDescription = computed(
    () => this.data.roles.find((role) => role.value === this.model().role)?.description ?? '',
  );

  protected done(): void {
    void submit(this.form);
  }

  protected async copy(link: string): Promise<void> {
    this.copied.set(await this.share.copy(link));
  }

  protected async shareLink(shown: InviteLink): Promise<void> {
    await this.share.share({
      title: `Invitación a ${this.data.spaceName}`,
      text: `Te invito a «${this.data.spaceName}» en Cuentas Claras.`,
      url: shown.link,
    });
  }

  protected close(): void {
    const shown = this.link();
    this.handle.close(shown ? { kind: 'link', ...shown } : undefined);
  }

  private async send(): Promise<undefined> {
    this.error.set(null);
    const { email, role } = this.model();
    const result = await this.data.invite(email, role);
    if (!result.ok) {
      this.error.set(result.message);
      return undefined;
    }
    if (result.value.kind === 'link') {
      this.link.set({ email: result.value.email, link: result.value.link });
      return undefined;
    }
    this.handle.close(result.value);
    return undefined;
  }
}
