/** Route path segments (UI routes are in Spanish). */
export const APP_PATHS = {
  login: 'iniciar-sesion',
  register: 'registro',
  forgotPassword: 'recuperar-contrasena',
  resetPassword: 'restablecer-contrasena',
  accounts: 'cuentas',
  categories: 'categorias',
  transactions: 'transacciones',
  budget: 'presupuesto',
  summary: 'resumen',
  settings: 'configuracion',
  /** Setup wizard (spec §7). */
  welcome: 'bienvenida',
  /** Design system catalog; only routed in development builds. */
  uiCatalog: 'ui',
} as const;

/** Child paths of Configuración. */
export const SETTINGS_PATHS = {
  tags: 'etiquetas',
} as const;

/** Child paths of Categorías: the edit mode, with each category's screen below it. */
export const CATEGORY_PATHS = {
  edit: 'editar',
} as const;

/** Path segment of the "create" screens (cuenta, categoría y etiqueta son femeninas). */
export const NEW_ITEM_PATH = 'nueva';

/** Query param with the category kind shown (Gastos / Ingresos) or created. */
export const CATEGORY_QUERY_PARAMS = { kind: 'clase' } as const;

/** Query param of the new account screen with the group picked in "¿Qué vas a crear?". */
export const ACCOUNT_QUERY_PARAMS = { group: 'grupo' } as const;

/** Route `data` flags the shell reads from the active route chain (spec §13.5). */
export const ROUTE_DATA_KEYS = {
  /** A create or edit flow: full screen in the compact window class. */
  flow: 'flow',
  /** List and detail side by side in the expanded window class. */
  listDetail: 'listDetail',
} as const;

/** Child paths of the setup wizard, one per step. */
export const ONBOARDING_STEP_PATHS = {
  space: 'espacio',
} as const;

/** Screen opened at `/` after signing in. */
export const DEFAULT_HOME_PATH = APP_PATHS.categories;

/** Query param that carries the URL to return to after signing in. */
export const REDIRECT_QUERY_PARAM = 'redirect';
