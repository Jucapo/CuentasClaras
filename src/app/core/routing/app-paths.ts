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

/** Child paths of Configuración that manage the space catalogs. */
export const SETTINGS_PATHS = {
  categories: 'categorias',
  tags: 'etiquetas',
} as const;

/** Path segment of the "create" screens (cuenta, categoría y etiqueta son femeninas). */
export const NEW_ITEM_PATH = 'nueva';

/** Query params of the new category screen: its kind and, for a subcategory, its parent. */
export const CATEGORY_QUERY_PARAMS = { kind: 'clase', parent: 'padre' } as const;

/** Child paths of the setup wizard, one per step. */
export const ONBOARDING_STEP_PATHS = {
  space: 'espacio',
} as const;

/** Screen opened at `/` after signing in. */
export const DEFAULT_HOME_PATH = APP_PATHS.categories;

/** Query param that carries the URL to return to after signing in. */
export const REDIRECT_QUERY_PARAM = 'redirect';
