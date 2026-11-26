/** Texts used inside the shared UI components. */
export const UI_TEXT = {
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',
  invalidField: 'Revisa este campo.',
  searchIcons: 'Buscar ícono',
  noIconsFound: 'No hay íconos con esa búsqueda.',
  pickIcon: 'Elegir ícono',
  pickColor: 'Elegir color',
  inheritColor: 'Igual que la categoría',
  close: 'Cerrar',
  cancel: 'Cancelar',
  dragToReorder: 'Arrastra para reordenar. Con el teclado: Alt y las flechas.',
} as const;

/** Why a typed amount was rejected, keyed by the domain's MoneyParseError. */
export const MONEY_PARSE_MESSAGES = {
  invalid: 'Escribe solo el monto, con números.',
  grouping: (decimal: string) =>
    `Revisa los separadores: los decimales van después de «${decimal}».`,
  too_many_decimals: (decimals: number) =>
    decimals === 0 ? 'Esta moneda no usa decimales.' : `Usa máximo ${decimals} decimales.`,
  negative: 'El monto no puede ser negativo.',
  too_large: 'El monto es demasiado grande.',
} as const;

/** Longest wait for the browser to drop a closed overlay's history entry. */
export const OVERLAY_HISTORY_CLEANUP_TIMEOUT_MS = 500;

/** Minimum widths (px) of the Material 3 window size classes; match src/styles/_breakpoints.scss. */
export const WINDOW_BREAKPOINTS = { medium: 600, expanded: 840 } as const;

/** Diameter of the spinner shown inside a loading button; matches --cc-icon-size-sm. */
export const BUTTON_SPINNER_DIAMETER = 20;
