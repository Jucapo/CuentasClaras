import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ToastService } from '../../shared/ui/services/toast.service';
import { PendingSaves } from '../saving/pending-saves';

/**
 * Leaves a screen with rows edited in place only after their saves end (spec §13.5). If one fails,
 * it stays and shows why, whatever the way out: a button, a link or the system back button.
 */
export const pendingSavesGuard: CanDeactivateFn<unknown> = async () => {
  const pendingSaves = inject(PendingSaves);
  const toast = inject(ToastService);
  const result = await pendingSaves.settle();
  if (!result.ok) {
    void toast.show(result.message);
  }
  return result.ok;
};
