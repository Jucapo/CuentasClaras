import { NavLink } from '../../shared/ui/organisms/bottom-nav/bottom-nav';
import { APP_PATHS } from '../routing/app-paths';

/** Bottom navigation tabs, in display order. */
export const NAV_ITEMS: readonly NavLink[] = [
  { path: APP_PATHS.accounts, label: 'Cuentas', icon: 'account_balance_wallet' },
  { path: APP_PATHS.categories, label: 'Categorías', icon: 'donut_large' },
  { path: APP_PATHS.transactions, label: 'Transacciones', icon: 'receipt_long' },
  { path: APP_PATHS.budget, label: 'Presupuesto', icon: 'savings' },
  { path: APP_PATHS.summary, label: 'Resumen', icon: 'bar_chart' },
];
