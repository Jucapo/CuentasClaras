import { dateParts, IsoDate } from '../../domain/dates/local-date';
import { monthName } from '../../domain/periods/period-labels';

/** Texts of the Presupuesto screen (spec §4.7). */
export const BUDGET_TEXT = {
  title: 'Presupuesto',
  expenses: 'Gastos',
  incomes: 'Ingresos esperados',
  expensesList: 'Presupuesto de gastos',
  incomesList: 'Ingresos esperados',
  general: 'General',
  emptyRow: 'Sin presupuesto',
  emptyIncome: 'Sin monto',
  noCategories: 'Crea categorías de gasto para ponerles presupuesto.',
  unbudgeted: 'Sin presupuesto:',
  scope: 'Alcance de los cambios',
  yearNote: 'Suma los 12 meses. Para cambiar montos, elige un mes.',
  noneTitle: 'El presupuesto se ve por mes o por año',
  noneDescription: 'Elige un mes en el selector de periodo para ver y cambiar los montos.',
  thisMonth: 'Ver este mes',
  offTitle: 'Los presupuestos están apagados',
  offOwner: 'Enciéndelos para ver cuánto queda de cada categoría.',
  offOthers: 'El propietario del espacio los apagó.',
  enable: 'Mostrar presupuestos',
  pickOne: 'Elige una categoría para ver y cambiar su presupuesto.',
  transactions: 'Ver transacciones',
  remove: 'Quitar presupuesto',
  calculatorLabel: 'Presupuesto para el mes',
  expectedLabel: 'Ingreso esperado para el mes',
} as const;

/** A month mid-sentence, e.g. "diciembre", with its year when it is not the one of `today`. */
export function monthLabel(month: IsoDate, today: IsoDate): string {
  const { year, month: number } = dateParts(month);
  const name = monthName(number).toLowerCase();
  return year === dateParts(today).year ? name : `${name} ${year}`;
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The two scopes of an edit, as the selector offers them (spec §4.7). */
export function scopeLabels(month: IsoDate, today: IsoDate) {
  const name = monthLabel(month, today);
  return { month: `Solo ${name}`, onward: `${capitalized(name)} y los siguientes` };
}

/** Under the header of a detail: which scope the edits take. */
export function scopeNote(scopeLabel: string): string {
  return `Los cambios rigen: ${scopeLabel.toLowerCase()}`;
}

/** The mark of a row whose amount is only for its month. */
export function monthOnlyMark(month: IsoDate, today: IsoDate): string {
  return `Solo ${monthLabel(month, today)}`;
}

/** The hint of a row that keeps its own amount from a later month when editing onward. */
export function keepsOwnHint(from: IsoDate, today: IsoDate): string {
  return `Desde ${monthLabel(from, today)} conserva su monto propio.`;
}

/** The confirmation before removing the budget of a category with a scope. */
export function removeConfirm(category: string, scopeLabel: string) {
  return {
    title: `¿Quitar el presupuesto de ${category}?`,
    message: `Se quitan el General y los de sus subcategorías (${scopeLabel.toLowerCase()}).`,
    confirmLabel: 'Quitar',
  };
}
