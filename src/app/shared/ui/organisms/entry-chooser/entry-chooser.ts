import { Component, input, output, signal } from '@angular/core';
import { TabOption, Tabs } from '../../atoms/tabs/tabs';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { UI_TEXT } from '../../ui.constants';
import { AccountList, AccountListGroup } from '../account-list/account-list';
import { CategoryGrid, CategoryGridItem } from '../category-grid/category-grid';

/** What "¿Qué vas a registrar?" picked: a category, or a transfer from an account. */
export type EntryChoice =
  | { readonly kind: 'category'; readonly categoryId: string }
  | { readonly kind: 'transfer'; readonly accountId: string };

/** Data of `cc-entry-chooser`. */
export interface EntryChooserData {
  readonly title: string;
  /** Top-level categories with what they got in the period, in their order. */
  readonly expenses: readonly CategoryGridItem[];
  readonly incomes: readonly CategoryGridItem[];
  /** Accounts the user can write, by group, with their balance. */
  readonly accountGroups: readonly AccountListGroup[];
  /** Currency of the amounts of the categories. */
  readonly currency: string;
}

type ChooserTab = 'income' | 'expense' | 'transfer';

const CHOOSER_TABS: readonly TabOption<ChooserTab>[] = [
  { value: 'income', label: 'Ingreso', icon: 'arrow_circle_up' },
  { value: 'expense', label: 'Gasto', icon: 'arrow_circle_down' },
  { value: 'transfer', label: 'Transferencia', icon: 'swap_horiz' },
];

const CHOOSER_TEXT = {
  tabs: 'Tipo de movimiento',
  expenses: 'Categorías de gasto',
  incomes: 'Categorías de ingreso',
  noCategories: 'No hay categorías de este tipo. Créalas en Categorías.',
} as const;

/**
 * "¿Qué vas a registrar?" (spec §7): Ingreso, Gasto and Transferencia as tabs, opening on Gasto.
 * Gasto and Ingreso show the categories of their kind with what each got in the period, in its
 * color; Transferencia shows the accounts by group with their balances. Picking one emits the
 * choice, which opens the quick entry.
 */
@Component({
  selector: 'cc-entry-chooser',
  imports: [OverlayPanel, Tabs, CategoryGrid, AccountList],
  templateUrl: './entry-chooser.html',
  styleUrl: './entry-chooser.scss',
})
export class EntryChooser {
  readonly data = input.required<EntryChooserData>();
  readonly chosen = output<EntryChoice>();
  readonly closed = output<void>();

  protected readonly tabs = CHOOSER_TABS;
  protected readonly text = CHOOSER_TEXT;
  protected readonly closeLabel = UI_TEXT.close;
  protected readonly tab = signal<ChooserTab>('expense');

  protected pickCategory(categoryId: string): void {
    this.chosen.emit({ kind: 'category', categoryId });
  }

  protected pickAccount(accountId: string): void {
    this.chosen.emit({ kind: 'transfer', accountId });
  }
}
