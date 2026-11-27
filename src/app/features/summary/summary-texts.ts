import { CategoryKind } from '../../core/categories/category.models';
import { ReportDimension } from '../../core/reports/reports.models';

/** Texts of the Resumen (spec §6, §7). */
export const SUMMARY_TEXT = {
  title: 'Resumen',
  balance: 'Balance',
  savingsRate: 'Tasa de ahorro',
  kindPicker: 'Qué mostrar',
  chart: 'Por día',
  averages: 'Promedios',
  perDay: 'Día (prom.)',
  perWeek: 'Semana (prom.)',
  month: 'Mes',
  perMonth: 'Mes (prom.)',
  byCategory: 'Por categoría',
  general: 'General',
  others: 'Otras',
  budget: 'Presupuesto',
  breakdown: 'Desglose',
  untagged: 'Sin etiqueta',
  othersPrivate: 'Cuentas privadas de otros',
  unknownPerson: 'Otra persona',
  tagsNote: 'Un movimiento con varias etiquetas cuenta en cada una, así que el % no suma 100.',
} as const;

/** Labels of each kind in the Resumen: its card, its budget row and its texts mid-sentence. */
export const SUMMARY_KIND_TEXT: Readonly<
  Record<CategoryKind, { readonly label: string; readonly lower: string }>
> = {
  expense: { label: 'Gastos', lower: 'gastos' },
  income: { label: 'Ingresos', lower: 'ingresos' },
};

/** Tabs of the breakdown, in order. */
export const DIMENSION_TABS: readonly {
  readonly value: ReportDimension;
  readonly label: string;
}[] = [
  { value: 'tag', label: 'Etiqueta' },
  { value: 'account', label: 'Cuenta' },
  { value: 'member', label: 'Persona' },
];

/** "Tasa de ahorro: 62 %". */
export function savingsRateLabel(percent: string): string {
  return `${SUMMARY_TEXT.savingsRate}: ${percent}`;
}

/** Accessible summary of the chart, e.g. "Gastos de Diciembre: $ X; la mayor es Mercado, $ Y". */
export function chartSummary(
  kind: CategoryKind,
  period: string,
  total: string,
  largest: { readonly name: string; readonly amount: string } | null,
): string {
  const head = `${SUMMARY_KIND_TEXT[kind].label} de ${period}: ${total}`;
  return largest ? `${head}; la mayor es ${largest.name}, ${largest.amount}.` : `${head}.`;
}

/** "Sin gastos en Diciembre". */
export function emptyKindText(kind: CategoryKind, period: string): string {
  return `Sin ${SUMMARY_KIND_TEXT[kind].lower} en ${period}.`;
}

/** Accessible name of a list of a kind, e.g. "Gastos por categoría". */
export function kindListLabel(kind: CategoryKind, by: string): string {
  return `${SUMMARY_KIND_TEXT[kind].label} ${by.toLowerCase()}`;
}
