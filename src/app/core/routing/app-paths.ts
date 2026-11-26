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

/** Screen opened at `/` after signing in. */
export const DEFAULT_HOME_PATH = APP_PATHS.categories;

/** Query param that carries the URL to return to after signing in. */
export const REDIRECT_QUERY_PARAM = 'redirect';
