import { computed, Injectable, signal } from '@angular/core';
import { ACTION_OK, actionFailed, ActionResult } from '../action-result';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';

/**
 * Saves started by rows edited in place (spec §13.5, "Menos modales"). The buttons and guards that
 * leave a screen wait for them, so a typed amount is never lost by navigating right away.
 */
@Injectable({ providedIn: 'root' })
export class PendingSaves {
  private readonly pending = new Set<Promise<ActionResult>>();
  private readonly count = signal(0);

  /** Whether some save is still running. */
  readonly busy = computed(() => this.count() > 0);

  /** Follows a save until it ends; a rejected promise counts as a failed save. */
  track(save: Promise<ActionResult>): Promise<ActionResult> {
    const settled = save.then(
      (result) => result,
      () => actionFailed(GENERIC_DATA_ERROR_MESSAGE),
    );
    this.pending.add(settled);
    this.count.set(this.pending.size);
    void settled.then(() => {
      this.pending.delete(settled);
      this.count.set(this.pending.size);
    });
    return settled;
  }

  /** Waits for the saves running now; resolves with the first failure among them, or ok. */
  async settle(): Promise<ActionResult> {
    const results = await Promise.all([...this.pending]);
    return results.find((result) => !result.ok) ?? ACTION_OK;
  }
}
