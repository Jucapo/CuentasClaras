import { TransactionStatus } from '../../domain/transactions/transaction-filters';
import { TransactionType } from '../../domain/transactions/transactions';

/** Limits of what a movement can hold (spec §4.2, §5.1 c). */
export const TRANSACTION_LIMITS = {
  /** Installments offered for a credit card purchase. */
  maxInstallments: 48,
  /** The monthly rate is below 100 % (the database stores it as a fraction under 1). */
  maxMonthlyRatePercent: 100,
  /** Decimals of the monthly rate in percent: the database keeps 6 decimals of the fraction. */
  ratePercentDecimals: 4,
  /** Decimals of a manual exchange rate (spec §4.6). */
  exchangeRateDecimals: 6,
  noteMaxLength: 500,
} as const;

/** Movements per page in the account detail and in Transacciones. */
export const TRANSACTION_PAGE_SIZE = 50;

/** Pause after the last key before the search of Transacciones runs. */
export const TRANSACTION_SEARCH_DEBOUNCE_MS = 300;

/** Names of the states of a movement (spec §4.2). */
export const TRANSACTION_STATUS_LABELS: Readonly<Record<TransactionStatus, string>> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
};

/** Icon and color of the movements without a category. */
export const UNCATEGORIZED_LOOK = {
  transfer: { icon: 'swap_horiz', color: null },
  adjustment: { icon: 'tune', color: null },
} as const;

/** "¿Qué vas a registrar?" in Transacciones (spec §7). */
export const NEW_TRANSACTION_CHOICE = {
  title: '¿Qué vas a registrar?',
  transferHint: 'Entre tus cuentas',
} as const;

/** Names of the kinds of movement. */
export const TRANSACTION_TYPE_LABELS: Readonly<Record<TransactionType, string>> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  adjustment: 'Ajuste',
};

/** Toasts after saving a movement, and the action that undoes a new one (spec §4.2). */
export const TRANSACTION_SAVED_TEXT = {
  created: {
    expense: 'Gasto guardado.',
    income: 'Ingreso guardado.',
    transfer: 'Transferencia guardada.',
    adjustment: 'Saldo ajustado.',
  },
  updated: 'Cambios guardados.',
  deleted: 'Movimiento eliminado.',
  undone: 'Se deshizo el movimiento.',
  undo: 'Deshacer',
} as const satisfies Record<string, unknown>;

/** Confirmation before deleting a movement. */
export const DELETE_TRANSACTION_CONFIRM = {
  title: '¿Eliminar este movimiento?',
  message: 'Se quita de la cuenta y de los totales. No se puede deshacer.',
  confirmLabel: 'Eliminar',
} as const;
