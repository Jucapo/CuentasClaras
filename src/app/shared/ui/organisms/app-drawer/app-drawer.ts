import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  Signal,
  signal,
} from '@angular/core';
import { InstallPlatform } from '../../../../domain/pwa/install-platform';
import { Avatar } from '../../atoms/avatar/avatar';
import { Button } from '../../atoms/button/button';
import { Icon } from '../../atoms/icon/icon';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { SegmentedControl, SegmentOption } from '../../atoms/segmented-control/segmented-control';
import { IconName } from '../../icons/icon-glyphs';
import { Brand } from '../../molecules/brand/brand';
import { InstallSteps } from '../../molecules/install-steps/install-steps';
import { DragDismiss } from '../../services/drag-dismiss';
import { OverlayViews } from '../../services/overlay-views';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';

/** A space of the user, in the menu. */
export interface AppDrawerSpace {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  /** Role of the user in it, e.g. "Propietario". */
  readonly role: string;
}

/** The user's light/dark preference, as stored (spec §13.2). */
export type AppDrawerTheme = 'system' | 'light' | 'dark';

/** What the menu shows and does; reads signals, so it follows changes while it is open. */
export interface AppDrawerData {
  readonly name: Signal<string>;
  readonly email: string;
  readonly spaces: readonly AppDrawerSpace[];
  readonly activeSpaceId: string | null;
  /** e.g. "2 miembros"; null while it loads. */
  readonly membersText: Signal<string | null>;
  readonly theme: Signal<AppDrawerTheme>;
  /** Applies a theme right away (spec §7). */
  readonly setTheme: (theme: AppDrawerTheme) => void;
  /** Whether the app runs installed; then "Instalar la app" does not show. */
  readonly installed: boolean;
  readonly installPlatform: InstallPlatform;
  /** The browser offers its install prompt. */
  readonly canPrompt: Signal<boolean>;
  /** Opens the browser's install prompt, inside the tap; true if the app was installed. */
  readonly install: () => Promise<boolean>;
  /** e.g. "0.10.0". */
  readonly version: string;
  /** Looks for a new version; true if one is on its way, null where updates are off. */
  readonly checkForUpdate: () => Promise<boolean | null>;
}

/** Where the menu sends the user; the shell goes there once the menu has closed. */
export type AppDrawerResult =
  | { readonly kind: 'settings' }
  | { readonly kind: 'members' }
  | { readonly kind: 'space'; readonly spaceId: string }
  | { readonly kind: 'signOut' };

type DrawerView = 'menu' | 'install' | 'about';

const APP_DRAWER_TEXT = {
  menu: 'Menú',
  spaces: 'Espacios',
  changeSpace: 'Cambiar de espacio',
  settings: 'Configuración',
  members: 'Miembros',
  theme: 'Tema',
  install: 'Instalar la app',
  about: 'Acerca de',
  version: (version: string) => `Versión ${version}`,
  checkForUpdate: 'Buscar actualizaciones',
  checking: 'Buscando',
  updateReady: 'Hay una versión nueva: aparecerá el aviso para recargar.',
  upToDate: 'Tienes la versión más reciente.',
  updatesOff: 'Las actualizaciones solo funcionan en la app publicada.',
  signOut: 'Cerrar sesión',
} as const;

const THEME_OPTIONS: readonly SegmentOption<AppDrawerTheme>[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

/** One row of the menu. */
interface DrawerRow {
  readonly id: 'settings' | 'members' | 'install' | 'about' | 'signOut';
  readonly icon: IconName;
  readonly label: string;
  readonly detail?: string | null;
}

/**
 * The side menu (spec §7), opened by the avatar: who is signed in and the active space (the others
 * unfold in place, with the role in each), then Configuración, Miembros, the theme, which changes
 * right away, installing the app while it is not installed, Acerca de with the version, and
 * Cerrar sesión. Installing and Acerca de are views inside the menu (spec §13.5). It slides in from
 * the start edge and closes with the system back button, Esc, a tap outside or a swipe.
 */
@Component({
  selector: 'cc-app-drawer',
  imports: [
    Avatar,
    Button,
    Icon,
    IconBadge,
    IconButton,
    SegmentedControl,
    Brand,
    InstallSteps,
    DragDismiss,
  ],
  templateUrl: './app-drawer.html',
  styleUrl: './app-drawer.scss',
})
export class AppDrawer {
  protected readonly data = inject<AppDrawerData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<AppDrawerResult>>(OverlayHandle);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly text = APP_DRAWER_TEXT;
  protected readonly ui = UI_TEXT;
  protected readonly themeOptions = THEME_OPTIONS;

  private readonly views = new OverlayViews<DrawerView>(
    'menu',
    this.host,
    inject(Injector),
    inject<OverlayHandle<unknown>>(OverlayHandle),
    '.view',
  );
  protected readonly view = this.views.current;

  protected readonly activeSpace = computed(
    () => this.data.spaces.find((space) => space.id === this.data.activeSpaceId) ?? null,
  );
  protected readonly otherSpaces = computed(() =>
    this.data.spaces.filter((space) => space.id !== this.data.activeSpaceId),
  );
  /** The other spaces unfold under the active one. */
  protected readonly spacesOpen = signal(false);
  protected readonly checking = signal(false);
  protected readonly updateMessage = signal<string | null>(null);

  protected readonly rows = computed<readonly DrawerRow[]>(() => [
    { id: 'settings', icon: 'settings', label: APP_DRAWER_TEXT.settings },
    {
      id: 'members',
      icon: 'group',
      label: APP_DRAWER_TEXT.members,
      detail: this.data.membersText(),
    },
  ]);
  protected readonly lowerRows = computed<readonly DrawerRow[]>(() => [
    ...(this.data.installed
      ? []
      : [
          {
            id: 'install' as const,
            icon: 'install_mobile' as const,
            label: APP_DRAWER_TEXT.install,
          },
        ]),
    {
      id: 'about',
      icon: 'info',
      label: APP_DRAWER_TEXT.about,
      detail: APP_DRAWER_TEXT.version(this.data.version),
    },
    { id: 'signOut', icon: 'logout', label: APP_DRAWER_TEXT.signOut },
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.views.destroy());
  }

  protected choose(row: DrawerRow['id']): void {
    switch (row) {
      case 'settings':
      case 'members':
      case 'signOut':
        this.handle.close({ kind: row });
        return;
      case 'install':
        void this.install();
        return;
      case 'about':
        this.updateMessage.set(null);
        this.views.enter('about');
        return;
    }
  }

  protected toggleSpaces(): void {
    this.spacesOpen.update((open) => !open);
  }

  protected pickSpace(spaceId: string): void {
    this.handle.close({ kind: 'space', spaceId });
  }

  protected setTheme(theme: AppDrawerTheme): void {
    this.data.setTheme(theme);
  }

  /** The browser's prompt where it offers one (inside the tap); the written steps otherwise. */
  protected async install(): Promise<void> {
    if (this.data.canPrompt()) {
      if (await this.data.install()) {
        this.handle.close();
      }
      return;
    }
    this.views.enter('install');
  }

  protected async promptFromSteps(): Promise<void> {
    if (await this.data.install()) {
      this.handle.close();
    }
  }

  protected async checkForUpdate(): Promise<void> {
    this.checking.set(true);
    this.updateMessage.set(null);
    const found = await this.data.checkForUpdate();
    this.checking.set(false);
    this.updateMessage.set(
      found === null
        ? APP_DRAWER_TEXT.updatesOff
        : found
          ? APP_DRAWER_TEXT.updateReady
          : APP_DRAWER_TEXT.upToDate,
    );
  }

  protected back(): void {
    this.views.back();
  }

  protected close(): void {
    this.handle.close();
  }
}
