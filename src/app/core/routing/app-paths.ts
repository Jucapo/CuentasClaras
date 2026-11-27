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
  currencies: 'monedas',
} as const;

/** Child path of an account: its screen to edit it, under its detail. */
export const ACCOUNT_PATHS = {
  edit: 'editar',
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

/** Route `data` flags the shell and the wizard read from the active route chain (spec §13.5). */
export const ROUTE_DATA_KEYS = {
  /** A create or edit flow: full screen in the compact window class. */
  flow: 'flow',
  /** List and detail side by side in the expanded window class. */
  listDetail: 'listDetail',
  /** Id of the wizard step a route belongs to. */
  onboardingStep: 'onboardingStep',
  /** Category kind a wizard step works with. */
  categoryKind: 'categoryKind',
  /** Where a flow goes after deleting what it edits, relative to it; `['..']` when absent. */
  afterDelete: 'afterDelete',
} as const;

/** Route data of a create or edit flow: full screen in the compact window class (spec §13.5). */
export const FLOW_ROUTE_DATA = { [ROUTE_DATA_KEYS.flow]: true } as const;

/** Route data of a list and its detail side by side in the expanded window class (spec §13.5). */
export const LIST_DETAIL_ROUTE_DATA = { [ROUTE_DATA_KEYS.listDetail]: true } as const;

/** Child paths of the setup wizard, one per step (spec §7). */
export const ONBOARDING_STEP_PATHS = {
  space: 'espacio',
  accounts: 'cuentas',
  income: 'ingresos',
  expenses: 'gastos',
  tags: 'etiquetas',
  budget: 'presupuesto',
  summary: 'resumen',
} as const;

/** Path of the suggested categories under the income and expense steps (spec Anexo A). */
export const TEMPLATE_PATH = 'plantilla';

/** Screen opened at `/` after signing in. */
export const DEFAULT_HOME_PATH = APP_PATHS.categories;

/** Path of each screen the app can open on (`user_settings.home_screen`, spec §7). */
export const HOME_SCREEN_PATHS = {
  accounts: APP_PATHS.accounts,
  categories: APP_PATHS.categories,
  transactions: APP_PATHS.transactions,
  budget: APP_PATHS.budget,
  summary: APP_PATHS.summary,
} as const;

/** Query param that carries the URL to return to after signing in. */
export const REDIRECT_QUERY_PARAM = 'redirect';
