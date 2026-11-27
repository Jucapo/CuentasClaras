import { DestroyRef, DOCUMENT, inject, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ToastService } from '../../shared/ui/services/toast.service';
import { APP_UPDATE_CHECK_INTERVAL_MS, APP_UPDATE_TEXT } from '../config/app.constants';

/**
 * Tells the user when a new version of the app is ready (spec §7): a notice that stays, with
 * "Recargar". It looks for one when the app comes back to the foreground and every so often, and
 * reloads when the service worker can no longer serve this version.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  // Absent where the service worker is not provided at all, e.g. unit tests.
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Starts watching; does nothing where the service worker is off (development, e2e). */
  init(): void {
    const updates = this.updates;
    if (!updates?.isEnabled) {
      return;
    }
    const ready = updates.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .subscribe(() => void this.offerReload(updates));
    const broken = updates.unrecoverable.subscribe(() => void this.recover());

    const view = this.document.defaultView;
    const check = () => void updates.checkForUpdate().catch(() => false);
    const onVisible = () => {
      if (this.document.visibilityState === 'visible') {
        check();
      }
    };
    this.document.addEventListener('visibilitychange', onVisible);
    const timer = view?.setInterval(check, APP_UPDATE_CHECK_INTERVAL_MS);

    this.destroyRef.onDestroy(() => {
      ready.unsubscribe();
      broken.unsubscribe();
      this.document.removeEventListener('visibilitychange', onVisible);
      if (timer !== undefined) {
        view?.clearInterval(timer);
      }
    });
  }

  /**
   * Looks for a new version now ("Buscar actualizaciones" in Acerca de): true if one is on its way,
   * and its notice follows; null where the service worker is off.
   */
  async check(): Promise<boolean | null> {
    if (!this.updates?.isEnabled) {
      return null;
    }
    return this.updates.checkForUpdate().catch(() => false);
  }

  private async offerReload(updates: SwUpdate): Promise<void> {
    const reload = await this.toast.showWithAction(APP_UPDATE_TEXT.ready, APP_UPDATE_TEXT.reload, {
      persistent: true,
    });
    if (reload) {
      await updates.activateUpdate().catch(() => false);
      this.document.location.reload();
    }
  }

  private async recover(): Promise<void> {
    await this.toast.show(APP_UPDATE_TEXT.broken);
    this.document.location.reload();
  }
}
