import { version } from '../../../../package.json';

/** Product name shown in the UI and in the document title. */
export const APP_NAME = 'Cuentas Claras';

/** Version of the app, from package.json: each phase raises the minor (F1g = 0.10, spec §13.2). */
export const APP_VERSION = version;

/** Logo shown next to the product name (rounded version, spec §13.2), relative to the base href. */
export const APP_LOGO_PATH = 'brand/cuentas-claras-logo.svg';

/** localStorage key that caches the theme preference so it applies before the user loads. */
export const THEME_STORAGE_KEY = 'cc-theme';

/** localStorage key of the single-key keyboard shortcuts preference (per device, spec §13.5). */
export const SHORTCUTS_STORAGE_KEY = 'cc-shortcuts';

/** localStorage key of the selected period (per device, spec §4.5). */
export const PERIOD_STORAGE_KEY = 'cc-period';

/** How long a screen that comes back waits for its content to restore its scroll (spec §13.5). */
export const SCROLL_RESTORE_TIMEOUT_MS = 1000;

/** How long snack bar notifications stay visible. */
export const SNACK_BAR_DURATION_MS = 4000;

/** How long a notification with an action (e.g. "Deshacer") stays visible. */
export const SNACK_BAR_ACTION_DURATION_MS = 6000;

/** How often an open app asks the service worker for a new version (besides on coming back). */
export const APP_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** The notice of a new version of the app (spec §7). */
export const APP_UPDATE_TEXT = {
  ready: 'Nueva versión disponible',
  reload: 'Recargar',
  broken: 'La app necesita recargarse para seguir funcionando.',
} as const;
