import { Component, inject, Signal } from '@angular/core';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { BudgetAmountChange } from '../budget-list/budget-list';
import { BudgetDetailData, BudgetDetail } from '../budget-detail/budget-detail';

/** Data of `cc-budget-detail-sheet`: the detail follows the saves while it is open. */
export interface BudgetDetailSheetData {
  readonly detail: Signal<BudgetDetailData | null>;
  /** Saves an amount typed in a row; the sheet stays open. */
  readonly save: (change: BudgetAmountChange) => void;
}

/**
 * What the page does after the sheet closes: a sheet never opens another (spec §13.5), so the
 * calculator, the confirmation to remove and the move to Transacciones come back as intents.
 */
export type BudgetDetailIntent =
  | { readonly kind: 'calculate'; readonly lineId: string }
  | { readonly kind: 'remove' }
  | { readonly kind: 'transactions' };

/** `cc-budget-detail` in an overlay: a sheet in the compact window class, a dialog elsewhere. */
@Component({
  selector: 'cc-budget-detail-sheet',
  imports: [BudgetDetail],
  templateUrl: './budget-detail-sheet.html',
})
export class BudgetDetailSheet {
  protected readonly data = inject<BudgetDetailSheetData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<BudgetDetailIntent>>(OverlayHandle);

  protected close(intent?: BudgetDetailIntent): void {
    this.handle.close(intent);
  }
}
