import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { SpaceService } from '../../core/spaces/space.service';
import {
  EMPTY_TRANSACTION_FILTERS,
  TransactionFilterKey,
  TransactionFilters,
} from '../../domain/transactions/transaction-filters';

/**
 * Search and filters of Transacciones (spec §7). They outlive the screen while the app is open, so
 * coming back keeps them; they start over with another space.
 */
@Injectable({ providedIn: 'root' })
export class TransactionFiltersStore {
  private readonly spaces = inject(SpaceService);

  /** What the search box holds. */
  readonly query = signal('');
  readonly filters = signal<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);

  constructor() {
    let spaceId: string | undefined;
    effect(() => {
      const current = this.spaces.activeSpace()?.id;
      if (current !== spaceId) {
        spaceId = current;
        untracked(() => this.reset());
      }
    });
  }

  /** Sets what one filter picks; an empty list turns it off. */
  set<K extends TransactionFilterKey>(key: K, values: TransactionFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: values }));
  }

  /** Turns every filter off. */
  clearFilters(): void {
    this.filters.set(EMPTY_TRANSACTION_FILTERS);
  }

  /** Empties the search and turns every filter off. */
  reset(): void {
    this.query.set('');
    this.clearFilters();
  }
}
