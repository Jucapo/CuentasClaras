import { Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Period } from '../../../domain/periods/periods';
import { currencySymbol } from '../../../domain/money/currencies';
import { formatMoney } from '../../../domain/money/money';
import { PeriodChip } from '../../../shared/ui/molecules/period-chip/period-chip';
import { MONEY_FORMAT } from '../../../shared/ui/money/money-format';
import {
  AppDrawer,
  AppDrawerData,
  AppDrawerResult,
  AppDrawerTheme,
} from '../../../shared/ui/organisms/app-drawer/app-drawer';
import {
  PeriodPanel,
  PeriodPanelData,
} from '../../../shared/ui/organisms/period-panel/period-panel';
import { OverlayService } from '../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../shared/ui/services/toast.service';
import { AppShell } from '../../../shared/ui/templates/app-shell/app-shell';
import { AuthService } from '../../auth/auth.service';
import { APP_VERSION } from '../../config/app.constants';
import { MEMBER_ROLE_LABELS } from '../../config/member.constants';
import { ExchangeRateFlow } from '../../exchange-rates/exchange-rate-flow';
import { ReceivedInvitation } from '../../invitations/invitation.models';
import { InvitationsService } from '../../invitations/invitations.service';
import { PeriodService } from '../../periods/period.service';
import { AppUpdateService } from '../../pwa/app-update.service';
import { InstallService } from '../../pwa/install.service';
import { ProfileService } from '../../profiles/profile.service';
import {
  APP_PATHS,
  INVITATION_QUERY_PARAMS,
  ROUTE_DATA_KEYS,
  SETTINGS_PATHS,
} from '../../routing/app-paths';
import { activeRouteData } from '../../routing/route-chain';
import { SpaceMembersService } from '../../spaces/space-members.service';
import { SpaceService } from '../../spaces/space.service';
import { ThemeService } from '../../theme/theme.service';
import { TotalsService } from '../../totals/totals.service';
import { NAV_ITEMS } from '../nav-items';
import { ScrollMemory } from '../scroll-memory';

const SHELL_TEXT = {
  navigation: 'Navegación principal',
  total: 'Total',
  period: 'Periodo',
  menu: 'Abrir el menú',
  menuTitle: 'Menú',
  loading: 'Cargando el total',
  themeFailed: 'No se pudo guardar el tema.',
  members: (count: number) => `${count} ${count === 1 ? 'miembro' : 'miembros'}`,
} as const;

/**
 * Signed-in area: fills the app shell template with the accounts total and the period selector
 * (spec §7), opens the menu from the avatar, asks once per visit for an exchange rate the totals
 * need (spec §4.6), and leaves when the session ends.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, AppShell, PeriodChip],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly overlay = inject(OverlayService);
  private readonly spaces = inject(SpaceService);
  private readonly members = inject(SpaceMembersService);
  private readonly totals = inject(TotalsService);
  private readonly rateFlow = inject(ExchangeRateFlow);
  private readonly format = inject(MONEY_FORMAT);
  private readonly profiles = inject(ProfileService);
  private readonly theme = inject(ThemeService);
  private readonly install = inject(InstallService);
  private readonly updates = inject(AppUpdateService);
  private readonly scrollMemory = inject(ScrollMemory);
  protected readonly periods = inject(PeriodService);

  protected readonly text = SHELL_TEXT;
  protected readonly navItems = NAV_ITEMS;
  private readonly invitations = inject(InvitationsService);
  private readonly toast = inject(ToastService);
  /** Currencies whose rate was already asked for in this visit. */
  private readonly askedRates = new Set<string>();
  /** Invitations already announced in this visit. */
  private readonly announcedInvitations = new Set<string>();

  /** `ROUTE_DATA_KEYS` flags set anywhere in the active route chain. */
  protected readonly routeFlags = computed(() => {
    // Only a dependency: the snapshot changes on every successful navigation.
    this.router.lastSuccessfulNavigation();
    const data = activeRouteData(this.router);
    return {
      flow: data[ROUTE_DATA_KEYS.flow] === true,
      subscreen: data[ROUTE_DATA_KEYS.subscreen] === true,
      listDetail: data[ROUTE_DATA_KEYS.listDetail] === true,
    };
  });

  /**
   * Accounts included in the total, in the main currency; says which rates are missing. Null while
   * it loads, so the header shows a placeholder instead of an amount.
   */
  protected readonly total = computed(() => {
    const total = this.totals.accountsTotal();
    if (!total) {
      return null;
    }
    const text = formatMoney(total.total, total.currency, this.format());
    const missing = total.missingRateCurrencies.map(currencySymbol).join(', ');
    return missing ? `${text} (sin ${missing})` : text;
  });

  protected readonly userName = computed(() => this.profiles.profile()?.display_name ?? '');

  constructor() {
    this.scrollMemory.init();
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this.scrollMemory.clear();
        void this.router.navigate(['/', APP_PATHS.login]);
      }
    });
    // An invitation to another space shows once per visit, outside flows.
    effect(() => {
      const invitation = this.invitations.mine()[0];
      if (!invitation || this.routeFlags().flow || this.announcedInvitations.has(invitation.id)) {
        return;
      }
      this.announcedInvitations.add(invitation.id);
      untracked(() => void this.announceInvitation(invitation));
    });
    // The first time a total needs a rate, ask for it; never in the middle of a flow.
    effect(() => {
      const missing = this.totals.missingRateCurrencies();
      if (this.routeFlags().flow || !this.spaces.canEdit()) {
        return;
      }
      const currency = missing.find((code) => !this.askedRates.has(code));
      if (currency) {
        this.askedRates.add(currency);
        untracked(() =>
          this.rateFlow.open(currency, {
            reason: `Tienes movimientos o cuentas en ${currencySymbol(currency)}. Para sumarlos en los totales hace falta la tasa de cambio.`,
          }),
        );
      }
    });
  }

  /** The side menu (spec §7): where it sends the user, once it has closed. */
  protected async openMenu(): Promise<void> {
    const data: AppDrawerData = {
      name: this.userName,
      email: this.auth.user()?.email ?? '',
      spaces: this.spaces.memberships().map((membership) => ({
        id: membership.space.id,
        name: membership.space.name,
        icon: membership.space.icon,
        color: membership.space.color,
        role: MEMBER_ROLE_LABELS[membership.role],
      })),
      activeSpaceId: this.spaces.activeSpace()?.id ?? null,
      membersText: computed(() => {
        const count = this.members.members().length;
        return count > 0 ? SHELL_TEXT.members(count) : null;
      }),
      theme: this.theme.preference,
      setTheme: (theme) => void this.changeTheme(theme),
      installed: this.install.isStandalone(),
      installPlatform: this.install.platform,
      canPrompt: this.install.canPrompt,
      install: () => this.install.prompt(),
      version: APP_VERSION,
      checkForUpdate: () => this.updates.check(),
    };
    const result = await this.overlay.open<AppDrawerResult, AppDrawerData>(AppDrawer, {
      label: SHELL_TEXT.menuTitle,
      size: 'drawer',
      autoFocus: 'cc-app-drawer button',
      data,
    });
    if (result) {
      await this.follow(result);
    }
  }

  private async follow(result: AppDrawerResult): Promise<void> {
    switch (result.kind) {
      case 'settings':
        await this.router.navigate(['/', APP_PATHS.settings]);
        return;
      case 'members':
        await this.router.navigate(['/', APP_PATHS.settings, SETTINGS_PATHS.members]);
        return;
      case 'space':
        if (result.spaceId !== this.spaces.activeSpace()?.id) {
          await this.spaces.select(result.spaceId);
          this.scrollMemory.clear();
          // Screens of the other space (an account, a category) do not exist here: start at home.
          await this.router.navigateByUrl('/');
        }
        return;
      case 'signOut':
        await this.auth.signOut();
        this.scrollMemory.clear();
        await this.router.navigate(['/', APP_PATHS.login]);
        return;
    }
  }

  private async changeTheme(theme: AppDrawerTheme): Promise<void> {
    const saved = await this.theme.set(theme);
    if (!saved.ok) {
      void this.toast.show(SHELL_TEXT.themeFailed);
    }
  }

  /** Once per visit, the invitations for the user to other spaces (spec §3.3). */
  private async announceInvitation(invitation: ReceivedInvitation): Promise<void> {
    const open = await this.toast.showWithAction(`Te invitaron a ${invitation.spaceName}.`, 'Ver', {
      persistent: true,
    });
    if (open) {
      await this.router.navigate(['/', APP_PATHS.invitation], {
        queryParams: { [INVITATION_QUERY_PARAMS.id]: invitation.id },
      });
    }
  }

  protected async choosePeriod(): Promise<void> {
    const period = await this.overlay.open<Period, PeriodPanelData>(PeriodPanel, {
      label: SHELL_TEXT.period,
      data: {
        period: this.periods.period(),
        settings: this.periods.settings(),
        today: this.periods.today(),
      },
    });
    if (period) {
      this.periods.select(period);
    }
  }
}
