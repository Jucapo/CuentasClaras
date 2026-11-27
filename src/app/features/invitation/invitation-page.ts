import { Component, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, maxLength, minLength, required, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { PASSWORD_MIN_LENGTH } from '../../core/auth/auth.constants';
import { AuthService } from '../../core/auth/auth.service';
import { MEMBER_ROLE_LABELS } from '../../core/config/member.constants';
import { DISPLAY_NAME_MAX_LENGTH } from '../../core/config/space.constants';
import { AcceptInvitationFlow } from '../../core/invitations/accept-invitation.flow';
import { InvitationRef, InvitationStatus } from '../../core/invitations/invitation.models';
import { InvitationsService } from '../../core/invitations/invitations.service';
import { InstallService } from '../../core/pwa/install.service';
import {
  APP_PATHS,
  INVITATION_QUERY_PARAMS,
  REDIRECT_QUERY_PARAM,
} from '../../core/routing/app-paths';
import { MemberRole } from '../../core/spaces/space.models';
import { InvitationLink, parseInvitationLink } from '../../domain/invitations/invitation-link';
import { Button } from '../../shared/ui/atoms/button/button';
import { Message } from '../../shared/ui/atoms/message/message';
import { PasswordField } from '../../shared/ui/atoms/password-field/password-field';
import { TextField } from '../../shared/ui/atoms/text-field/text-field';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../shared/ui/molecules/form/form';
import { InstallSteps } from '../../shared/ui/molecules/install-steps/install-steps';
import { InvitationCard } from '../../shared/ui/molecules/invitation-card/invitation-card';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { ConfirmService } from '../../shared/ui/services/confirm.service';
import { ToastService } from '../../shared/ui/services/toast.service';
import { AUTH_VALIDATION_MESSAGES, matchesPassword } from '../auth/auth-validation';

/** The invitation as the page shows it, from the preview (a link) or `my_invitations` (the app). */
interface InvitationDetails {
  readonly spaceName: string;
  readonly spaceIcon: string;
  readonly spaceColor: string;
  readonly inviterName: string | null;
  readonly role: MemberRole;
  readonly email: string;
  readonly status: InvitationStatus;
}

/**
 * What the page shows:
 * - `new-account`: the email to a new account; name and password, then accept;
 * - `sign-in`: an existing account (or a spent email link) signs in first;
 * - `wrong-account`: this browser is signed in with another email;
 * - `answer`: signed in as the invitee; accept or decline;
 * - `closed`: expired, used or revoked; `invalid`: an unknown or broken link;
 * - `accepted` and `declined`: done.
 */
type Stage =
  | 'loading'
  | 'invalid'
  | 'closed'
  | 'new-account'
  | 'sign-in'
  | 'wrong-account'
  | 'answer'
  | 'accepted'
  | 'declined';

const CLOSED_MESSAGES: Readonly<Record<Exclude<InvitationStatus, 'pending'>, string>> = {
  expired: 'Esta invitación venció. Pide a quien te invitó que te la reenvíe.',
  accepted: 'Esta invitación ya se aceptó. Si es tuya, entra a la app con tu correo y contraseña.',
  declined: 'Esta invitación se rechazó.',
  revoked: 'Esta invitación fue revocada.',
};

/**
 * `/invitacion` (spec §3.3). It opens in the browser of the email (Safari on iPhone, not the
 * installed app), so it works without a previous session and ends with how to install the app and
 * sign in there with the password.
 */
@Component({
  selector: 'app-invitation-page',
  imports: [
    FormField,
    PageHeader,
    Form,
    FormActions,
    TextField,
    PasswordField,
    Button,
    Message,
    InvitationCard,
    InstallSteps,
  ],
  templateUrl: './invitation-page.html',
  styleUrl: './invitation-page.scss',
})
export class InvitationPage {
  private readonly auth = inject(AuthService);
  private readonly invitations = inject(InvitationsService);
  private readonly acceptFlow = inject(AcceptInvitationFlow);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly install = inject(InstallService);

  private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap);

  private readonly link = computed<InvitationLink>(() => {
    const params = this.queryParams();
    return parseInvitationLink({
      token: params?.get(INVITATION_QUERY_PARAMS.token) ?? null,
      tokenHash: params?.get(INVITATION_QUERY_PARAMS.tokenHash) ?? null,
      type: params?.get(INVITATION_QUERY_PARAMS.type) ?? null,
      id: params?.get(INVITATION_QUERY_PARAMS.id) ?? null,
    });
  });

  private readonly preview = resource({
    params: () => {
      const link = this.link();
      return link.kind === 'email' || link.kind === 'link' ? link.token : undefined;
    },
    loader: ({ params: token }) => this.invitations.preview(token),
  });

  protected readonly outcome = signal<'accepted' | 'declined' | null>(null);
  /** Auth's part of the email link was already used or expired. */
  protected readonly linkUsed = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly answering = signal(false);

  protected readonly details = computed<InvitationDetails | null>(() => {
    const link = this.link();
    if (link.kind === 'app') {
      const found = this.invitations.mine().find((i) => i.id === link.invitationId);
      return found ? { ...found, email: this.signedInEmail() ?? '', status: 'pending' } : null;
    }
    const loaded = this.preview.hasValue() ? this.preview.value() : null;
    return loaded?.ok ? loaded.value : null;
  });

  protected readonly loadError = computed(() => {
    const loaded = this.preview.hasValue() ? this.preview.value() : null;
    return loaded && !loaded.ok ? loaded.message : null;
  });

  protected readonly roleLabel = computed(() => {
    const details = this.details();
    return details ? MEMBER_ROLE_LABELS[details.role] : '';
  });

  private readonly signedInEmail = computed(() => this.auth.user()?.email?.toLowerCase() ?? null);

  protected readonly stage = computed<Stage>(() => {
    const outcome = this.outcome();
    if (outcome) {
      return outcome;
    }
    const link = this.link();
    if (link.kind === 'invalid') {
      return 'invalid';
    }
    if (link.kind === 'app') {
      if (!this.auth.isAuthenticated()) {
        return 'sign-in';
      }
      if (!this.invitations.mineLoaded()) {
        return 'loading';
      }
      return this.details() ? 'answer' : 'closed';
    }
    if (this.preview.isLoading()) {
      return 'loading';
    }
    const details = this.details();
    if (!details) {
      return this.loadError() ? 'closed' : 'invalid';
    }
    if (details.status !== 'pending') {
      return 'closed';
    }
    if (link.kind === 'email' && !this.linkUsed()) {
      return 'new-account';
    }
    const signedIn = this.signedInEmail();
    if (!signedIn) {
      return 'sign-in';
    }
    return signedIn === details.email ? 'answer' : 'wrong-account';
  });

  protected readonly closedMessage = computed(() => {
    const loadError = this.loadError();
    if (loadError) {
      return loadError;
    }
    const status = this.details()?.status;
    return status && status !== 'pending'
      ? CLOSED_MESSAGES[status]
      : 'Esta invitación ya no está pendiente.';
  });

  /** On the installed app or from the in-app notice, the steps to install are not needed. */
  protected readonly showInstallSteps = computed(
    () => this.link().kind !== 'app' && !this.install.isStandalone(),
  );

  private readonly model = signal({ displayName: '', password: '', confirmPassword: '' });
  protected readonly accountForm = form(
    this.model,
    (path) => {
      required(path.displayName, { message: 'Escribe tu nombre.' });
      validate(path.displayName, ({ value }) =>
        value().trim() ? undefined : { kind: 'blank', message: 'Escribe tu nombre.' },
      );
      maxLength(path.displayName, DISPLAY_NAME_MAX_LENGTH, {
        message: `Usa máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`,
      });
      required(path.password, { message: AUTH_VALIDATION_MESSAGES.newPasswordRequired });
      minLength(path.password, PASSWORD_MIN_LENGTH, {
        message: AUTH_VALIDATION_MESSAGES.passwordTooShort,
      });
      required(path.confirmPassword, {
        message: AUTH_VALIDATION_MESSAGES.confirmPasswordRequired,
      });
      validate(
        path.confirmPassword,
        matchesPassword(() => this.model().password),
      );
    },
    { submission: { action: () => this.acceptAsNewAccount() } },
  );

  /** Signs in on the login page and comes back here, without Auth's spent part of the link. */
  protected signIn(): Promise<boolean> {
    return this.router.navigate(['/', APP_PATHS.login], {
      queryParams: { [REDIRECT_QUERY_PARAM]: this.returnUrl() },
    });
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  protected async accept(): Promise<void> {
    const ref = this.ref();
    if (!ref) {
      return;
    }
    this.error.set(null);
    this.answering.set(true);
    const result = await this.invitations.accept(ref);
    this.answering.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    await this.finishAccepting();
  }

  protected async decline(): Promise<void> {
    const ref = this.ref();
    const details = this.details();
    if (!ref || !details) {
      return;
    }
    const confirmed = await this.confirm.confirm({
      title: `¿Rechazar la invitación a ${details.spaceName}?`,
      message: 'El link deja de servir. Si cambias de opinión, pide que te inviten de nuevo.',
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.error.set(null);
    this.answering.set(true);
    const result = await this.invitations.decline(ref);
    this.answering.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    this.outcome.set('declined');
  }

  protected async installApp(): Promise<void> {
    await this.install.prompt();
  }

  protected openApp(): Promise<boolean> {
    return this.router.navigateByUrl('/');
  }

  private async acceptAsNewAccount(): Promise<void> {
    const link = this.link();
    const details = this.details();
    if (link.kind !== 'email' || !details) {
      return;
    }
    this.error.set(null);
    const { displayName, password } = this.model();
    const result = await this.acceptFlow.acceptAsNewAccount({
      token: link.token,
      tokenHash: link.tokenHash,
      email: details.email,
      displayName,
      password,
    });
    if (result.ok) {
      await this.finishAccepting();
      return;
    }
    if (result.reason === 'link_used') {
      this.linkUsed.set(true);
      return;
    }
    this.error.set(result.message);
  }

  private async finishAccepting(): Promise<void> {
    if (this.showInstallSteps()) {
      this.outcome.set('accepted');
      return;
    }
    void this.toast.show(`Ya eres parte de ${this.details()?.spaceName ?? 'el espacio'}.`);
    await this.router.navigateByUrl('/');
  }

  private ref(): InvitationRef | null {
    const link = this.link();
    if (link.kind === 'app') {
      return { invitationId: link.invitationId };
    }
    return link.kind === 'invalid' ? null : { token: link.token };
  }

  private returnUrl(): string {
    const link = this.link();
    const params =
      link.kind === 'app'
        ? { [INVITATION_QUERY_PARAMS.id]: link.invitationId }
        : link.kind === 'invalid'
          ? {}
          : { [INVITATION_QUERY_PARAMS.token]: link.token };
    return this.router.serializeUrl(
      this.router.createUrlTree(['/', APP_PATHS.invitation], { queryParams: params }),
    );
  }
}
