import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { detectInstallPlatform, InstallPlatform } from '../../domain/pwa/install-platform';

/** Chromium's install prompt event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** iOS Safari's flag for a page opened from the home screen. */
interface IosNavigator extends Navigator {
  readonly standalone?: boolean;
}

/**
 * Installing the PWA after accepting an invitation (spec §3.3): the platform for the instructions,
 * whether the app already runs installed, and Chromium's install prompt (Android and desktop).
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);

  /** Whether the browser offered its install prompt, so an "Instalar" button can open it. */
  readonly canPrompt = computed(() => this.deferredPrompt() !== null);

  /** Where the app is opened. */
  readonly platform: InstallPlatform = this.window
    ? detectInstallPlatform(this.window.navigator.userAgent, this.window.navigator.maxTouchPoints)
    : 'other';

  /**
   * Starts listening at startup: the browser offers the prompt once, soon after loading. The event
   * is kept without preventDefault, so the browser's own install UI stays as it is.
   */
  init(): void {
    this.window?.addEventListener('beforeinstallprompt', (event) => {
      this.deferredPrompt.set(event as BeforeInstallPromptEvent);
    });
    this.window?.addEventListener('appinstalled', () => this.deferredPrompt.set(null));
  }

  /** Whether the page runs as the installed app (home screen or app window). */
  isStandalone(): boolean {
    if (!this.window) {
      return false;
    }
    return (
      this.window.matchMedia('(display-mode: standalone)').matches ||
      (this.window.navigator as IosNavigator).standalone === true
    );
  }

  /** Opens the browser's install prompt; true if the user installed the app. */
  async prompt(): Promise<boolean> {
    const event = this.deferredPrompt();
    if (!event) {
      return false;
    }
    this.deferredPrompt.set(null);
    try {
      await event.prompt();
      return (await event.userChoice).outcome === 'accepted';
    } catch {
      // The browser may refuse an event it already used; the written steps still apply.
      return false;
    }
  }
}
