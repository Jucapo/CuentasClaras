import { IconName } from '../../shared/ui/icons/icon-glyphs';

/** Product name shown in the UI and in the document title. */
export const APP_NAME = 'Cuentas Claras';

/** Icon shown next to the product name. */
export const APP_BRAND_ICON: IconName = 'account_balance_wallet';

/** localStorage key that caches the theme preference so it applies before the user loads. */
export const THEME_STORAGE_KEY = 'cc-theme';

/** localStorage key of the single-key keyboard shortcuts preference (per device, spec §13.5). */
export const SHORTCUTS_STORAGE_KEY = 'cc-shortcuts';

/** localStorage key of the selected period (per device, spec §4.5). */
export const PERIOD_STORAGE_KEY = 'cc-period';

/** How long snack bar notifications stay visible. */
export const SNACK_BAR_DURATION_MS = 4000;

/** How long a notification with an action (e.g. "Deshacer") stays visible. */
export const SNACK_BAR_ACTION_DURATION_MS = 6000;
