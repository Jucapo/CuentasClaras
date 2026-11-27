import { computed, inject, Provider } from '@angular/core';
import { recentIcons } from '../../shared/ui/icons/icon-search';
import { RECENT_ICONS } from '../../shared/ui/icons/recent-icons';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';

/** Binds the design system's RECENT_ICONS to the newest accounts and categories of the space. */
export function provideRecentIcons(): Provider {
  return {
    provide: RECENT_ICONS,
    useFactory: () => {
      const accounts = inject(AccountsService);
      const categories = inject(CategoriesService);
      return computed(() => recentIcons([...accounts.accounts(), ...categories.categories()]));
    },
  };
}
