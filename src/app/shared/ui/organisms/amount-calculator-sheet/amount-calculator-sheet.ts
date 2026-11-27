import { Component, inject } from '@angular/core';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { AmountCalculator, AmountCalculatorData } from '../amount-calculator/amount-calculator';

/**
 * `cc-amount-calculator` as its own overlay, e.g. from the detail pane of the expanded class;
 * resolves with the result.
 */
@Component({
  selector: 'cc-amount-calculator-sheet',
  imports: [AmountCalculator],
  templateUrl: './amount-calculator-sheet.html',
})
export class AmountCalculatorSheet {
  protected readonly data = inject<AmountCalculatorData>(OVERLAY_DATA);
  protected readonly handle = inject<OverlayHandle<number>>(OverlayHandle);
}
