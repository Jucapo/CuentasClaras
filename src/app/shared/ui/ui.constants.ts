/** Texts used inside the shared UI components. */
export const UI_TEXT = {
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',
  invalidField: 'Revisa este campo.',
  searchIcons: 'Buscar ícono',
  noIconsFound: 'No hay íconos con esa búsqueda.',
  appearanceTitle: 'Ícono y color',
  changeAppearance: 'Cambiar ícono y color',
  iconTab: 'Ícono',
  colorTab: 'Color',
  colorGrid: 'Colores',
  inheritColor: 'Igual que la categoría',
  close: 'Cerrar',
  back: 'Volver',
  cancel: 'Cancelar',
  done: 'Listo',
  save: 'Guardar',
  moreOptions: 'Más opciones',
  dragToReorder: 'Arrastra para reordenar. Con el teclado: Alt y las flechas.',
  gridEditHelp: 'Toca una categoría para editarla. Mantenla presionada y arrástrala para moverla.',
  gridEditHelpKeyboard: 'Con el teclado: Alt y las flechas para moverla.',
  overBudget: 'Te pasaste',
  remaining: 'quedan',
  previousPeriod: 'Periodo anterior',
  nextPeriod: 'Periodo siguiente',
  choosePeriod: 'Elegir periodo',
  loadMore: 'Ver más',
} as const;

/** Labels of the quick-entry keypad keys (spec §7). */
export const KEYPAD_TEXT = {
  label: 'Teclado de monto',
  backspace: 'Borrar',
  plus: 'Sumar',
  minus: 'Restar',
  decimal: 'Decimales',
  thousands: 'Tres ceros',
} as const;

/** SVG geometry of `cc-donut`, in viewBox units. */
export const DONUT_GEOMETRY = {
  viewBox: '0 0 100 100',
  center: 50,
  radius: 44,
  stroke: 8,
  /** Space between segments, along the ring. */
  segmentGap: 1.5,
} as const;

/** How long a touch must be held before a drag starts, so scrolling a grid keeps working. */
export const TOUCH_DRAG_DELAY_MS = 300;

/** Why a typed amount was rejected, keyed by the domain's MoneyParseError. */
export const MONEY_PARSE_MESSAGES = {
  invalid: 'Escribe solo el monto, con números.',
  grouping: (decimal: string) =>
    `Revisa los separadores: los decimales van después de «${decimal}».`,
  too_many_decimals: (decimals: number) =>
    decimals === 0 ? 'Esta moneda no usa decimales.' : `Usa máximo ${decimals} decimales.`,
  negative: 'El monto no puede ser negativo.',
  negativeNumber: 'El número no puede ser negativo.',
  too_large: 'El monto es demasiado grande.',
} as const;

/** Longest wait for the browser to drop a closed overlay's history entry. */
export const OVERLAY_HISTORY_CLEANUP_TIMEOUT_MS = 500;

/** Minimum widths (px) of the Material 3 window size classes; match src/styles/_breakpoints.scss. */
export const WINDOW_BREAKPOINTS = { medium: 600, expanded: 840 } as const;

/** Diameter of the spinner shown inside a loading button; matches --cc-icon-size-sm. */
export const BUTTON_SPINNER_DIAMETER = 20;

/** Class of the self-hosted icon font, defined in src/styles/_fonts.scss; set on every mat-icon. */
export const ICON_FONT_CLASS = 'cc-symbols';
