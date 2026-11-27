import { TransactionFilterKey } from '../../domain/transactions/transaction-filters';

/** Names of the filter chips of Transacciones (spec §7). */
export const TRANSACTION_FILTER_LABELS: Readonly<Record<TransactionFilterKey, string>> = {
  accountIds: 'Cuenta',
  categoryIds: 'Categoría',
  tagIds: 'Etiqueta',
  types: 'Tipo',
  authorIds: 'Persona',
  statuses: 'Estado',
};

/** Texts of the Transacciones screen. */
export const TRANSACTIONS_TEXT = {
  title: 'Transacciones',
  search: 'Buscar',
  searchPlaceholder: 'Nota, categoría, cuenta o monto',
  filters: 'Filtros',
  totals: 'Totales de lo que se ve',
  balances: 'Saldos del periodo',
  openingBalance: 'Saldo inicial',
  closingBalance: 'Saldo final',
  income: 'Ingresos',
  expense: 'Gastos',
  net: 'Neto',
  list: 'Movimientos',
  add: 'Nuevo movimiento',
  empty: (period: string) => `No hay movimientos en ${period}.`,
  noMatches: 'Nada coincide con la búsqueda o los filtros.',
  clearAll: 'Limpiar búsqueda y filtros',
  pickOne: 'Elige un movimiento para editarlo, o registra uno nuevo.',
  archived: 'Archivadas',
  archivedOne: 'Archivada',
} as const;

/**
 * The line under the totals when part of them comes from accounts outside the space (spec §7), with
 * the amounts already formatted; null when nothing does.
 */
export function outsideSpaceNote(expense: string | null, income: string | null): string | null {
  if (expense && income) {
    return `Incluye ${expense} en gastos y ${income} en ingresos de cuentas fuera del espacio`;
  }
  const amount = expense ?? income;
  return amount ? `Incluye ${amount} de cuentas fuera del espacio` : null;
}
