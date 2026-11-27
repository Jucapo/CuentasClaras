import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { ToastService } from '../../shared/ui/services/toast.service';
import { APP_UPDATE_TEXT } from '../config/app.constants';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  const versionUpdates = new Subject<VersionEvent>();
  const unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();
  const updates = {
    isEnabled: true,
    versionUpdates,
    unrecoverable,
    checkForUpdate: vi.fn(),
    activateUpdate: vi.fn(),
  };
  const toast = { show: vi.fn(), showWithAction: vi.fn() };
  const reload = vi.fn();

  function setup(enabled = true): AppUpdateService {
    updates.isEnabled = enabled;
    updates.checkForUpdate.mockReset().mockResolvedValue(false);
    updates.activateUpdate.mockReset().mockResolvedValue(true);
    toast.show.mockReset().mockResolvedValue(undefined);
    toast.showWithAction.mockReset();
    reload.mockReset();
    const document = {
      visibilityState: 'visible',
      defaultView: { setInterval: vi.fn(() => 1), clearInterval: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { reload },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: updates },
        { provide: ToastService, useValue: toast },
        { provide: DOCUMENT, useValue: document },
      ],
    });
    const service = TestBed.inject(AppUpdateService);
    service.init();
    return service;
  }

  const ready = { type: 'VERSION_READY' } as VersionEvent;

  it('offers to reload when a new version is ready, and reloads on the action', async () => {
    setup();
    toast.showWithAction.mockResolvedValue(true);

    versionUpdates.next(ready);

    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(toast.showWithAction).toHaveBeenCalledWith(
      APP_UPDATE_TEXT.ready,
      APP_UPDATE_TEXT.reload,
      { persistent: true },
    );
    expect(updates.activateUpdate).toHaveBeenCalled();
  });

  it('does not reload when the notice goes away without the action', async () => {
    setup();
    toast.showWithAction.mockResolvedValue(false);

    versionUpdates.next(ready);

    await vi.waitFor(() => expect(toast.showWithAction).toHaveBeenCalled());
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it('ignores the other events of the service worker', () => {
    setup();

    versionUpdates.next({ type: 'VERSION_DETECTED' } as VersionEvent);

    expect(toast.showWithAction).not.toHaveBeenCalled();
  });

  it('warns and reloads when the service worker can no longer serve this version', async () => {
    setup();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(toast.show).toHaveBeenCalledWith(APP_UPDATE_TEXT.broken);
  });

  it('does nothing where the service worker is off', () => {
    setup(false);

    versionUpdates.next(ready);

    expect(toast.showWithAction).not.toHaveBeenCalled();
  });
});
