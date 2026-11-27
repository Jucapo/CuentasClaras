import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  Signal,
  signal,
} from '@angular/core';
import { ConfirmOptions, ConfirmPanel } from '../../molecules/confirm-panel/confirm-panel';
import { LeaveView, OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { AmountCalculator, AmountCalculatorData } from '../amount-calculator/amount-calculator';
import { BudgetAmountChange } from '../budget-list/budget-list';
import {
  budgetCalculatorData,
  BudgetDetail,
  BudgetDetailData,
} from '../budget-detail/budget-detail';

/** Data of `cc-budget-detail-sheet`: the detail follows the saves while it is open. */
export interface BudgetDetailSheetData {
  readonly detail: Signal<BudgetDetailData | null>;
  /** Saves an amount typed in a row or calculated; resolves whether it was saved. */
  readonly save: (change: BudgetAmountChange) => Promise<boolean>;
  /** The question before "Quitar presupuesto"; null when there is nothing to remove. */
  readonly removeQuestion: () => ConfirmOptions | null;
  /** Removes the budget of the category, once confirmed; resolves whether it was removed. */
  readonly remove: () => Promise<boolean>;
}

/** What the page does after the sheet closes: "Ver transacciones" leaves the screen. */
export type BudgetDetailIntent = 'transactions';

type SheetView =
  | { readonly kind: 'detail' }
  | { readonly kind: 'calculate'; readonly lineId: string; readonly data: AmountCalculatorData }
  | { readonly kind: 'remove'; readonly question: ConfirmOptions };

const DETAIL_VIEW: SheetView = { kind: 'detail' };

// A calculated amount has no row text to put back: the row reads the saved amount.
const NOTHING_TO_REVERT = (): void => undefined;

/** Where the detail was when a view covered it. */
interface DetailPlace {
  readonly scroll: readonly (readonly [Element, number])[];
  readonly focus: HTMLElement | null;
}

/**
 * `cc-budget-detail` in an overlay: a sheet in the compact window class, a dialog elsewhere. The
 * calculator of a line and the confirmation of "Quitar presupuesto" are views inside the same
 * overlay (spec §13.5): ←, Esc and the system back button return to the detail, which keeps its
 * scroll and gets the focus back where it was.
 */
@Component({
  selector: 'cc-budget-detail-sheet',
  imports: [BudgetDetail, AmountCalculator, ConfirmPanel],
  templateUrl: './budget-detail-sheet.html',
  host: { '(keydown.escape)': 'onEscape($event)' },
})
export class BudgetDetailSheet {
  protected readonly data = inject<BudgetDetailSheetData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<BudgetDetailIntent>>(OverlayHandle);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  private readonly view = signal<SheetView>(DETAIL_VIEW);
  protected readonly inDetail = computed(() => this.view().kind === 'detail');
  protected readonly calculator = computed(() => {
    const view = this.view();
    return view.kind === 'calculate' ? view : null;
  });
  protected readonly removal = computed(() => {
    const view = this.view();
    return view.kind === 'remove' ? view : null;
  });
  protected readonly busy = signal(false);

  private leaveView: LeaveView | null = null;
  private detailPlace: DetailPlace | null = null;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  protected close(intent?: BudgetDetailIntent): void {
    this.handle.close(intent);
  }

  protected calculate(lineId: string): void {
    const detail = this.data.detail();
    const data = detail && budgetCalculatorData(detail, lineId);
    if (data) {
      this.enter({ kind: 'calculate', lineId, data });
    }
  }

  protected askRemove(): void {
    const question = this.data.removeQuestion();
    if (question) {
      this.enter({ kind: 'remove', question });
    }
  }

  /** Saves the result and returns to the detail; on a failure (already told) it stays. */
  protected async calculated(lineId: string, currency: string, amount: number): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    const saved = await this.data.save({
      categoryId: lineId,
      amount,
      currency,
      revert: NOTHING_TO_REVERT,
    });
    this.busy.set(false);
    if (saved) {
      this.back();
    }
  }

  protected async answered(confirmed: boolean): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (confirmed) {
      this.busy.set(true);
      await this.data.remove();
      this.busy.set(false);
    }
    this.back();
  }

  /** ← and Esc in a view. */
  protected back(): void {
    const leave = this.leaveView;
    this.leaveView = null;
    leave?.();
    this.showDetail();
  }

  protected onEscape(event: Event): void {
    // Esc in a view goes back to the detail instead of closing the overlay.
    if (!this.inDetail() && !this.busy()) {
      event.preventDefault();
      event.stopPropagation();
      this.back();
    }
  }

  private enter(view: SheetView): void {
    this.detailPlace = {
      scroll: scrollPositions(this.host),
      focus: activeElementIn(this.host),
    };
    this.view.set(view);
    this.leaveView = this.handle.enterView(() => {
      // The system back button.
      this.leaveView = null;
      if (!this.busy()) {
        this.showDetail();
      }
    });
    afterNextRender(() => focusHeading(this.host.querySelector('.view')), {
      injector: this.injector,
    });
  }

  private showDetail(): void {
    if (this.destroyed || this.inDetail()) {
      return;
    }
    const place = this.detailPlace;
    this.detailPlace = null;
    this.view.set(DETAIL_VIEW);
    afterNextRender(
      () => {
        place?.focus?.focus({ preventScroll: true });
        for (const [element, top] of place?.scroll ?? []) {
          element.scrollTop = top;
        }
      },
      { injector: this.injector },
    );
  }
}

/** The scrolled elements of the detail and of the overlay around it. */
function scrollPositions(root: HTMLElement): (readonly [Element, number])[] {
  const elements: Element[] = Array.from(root.querySelectorAll('*'));
  for (let element = root.parentElement; element; element = element.parentElement) {
    elements.push(element);
  }
  return elements
    .filter((element) => element.scrollTop > 0)
    .map((element) => [element, element.scrollTop] as const);
}

function activeElementIn(root: HTMLElement): HTMLElement | null {
  const active = root.ownerDocument.activeElement;
  return active instanceof HTMLElement && root.contains(active) ? active : null;
}

/** The title of a view gets the focus, so it is announced and the keyboard types into it. */
function focusHeading(view: Element | null): void {
  const heading = view?.querySelector<HTMLElement>('h2');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
}
