import { Component, computed, inject, input, output } from '@angular/core';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { LayoutService } from '../../services/layout.service';
import { UI_TEXT } from '../../ui.constants';

/**
 * Layout of a create or edit flow (spec §13.5): top bar with close ("✕" when creating, "←" when
 * editing), title and main action (`[ccFlowAction]`); a header band (`[ccFlowHero]`) with the
 * large name and the icon badge; and the body (default slot) with the field rows.
 */
@Component({
  selector: 'cc-flow-layout',
  imports: [IconButton],
  templateUrl: './flow-layout.html',
  styleUrl: './flow-layout.scss',
  host: { '[class]': "'window-' + layout.windowClass()" },
})
export class FlowLayout {
  protected readonly layout = inject(LayoutService);

  readonly title = input.required<string>();
  /** `close` discards a new item; `back` leaves an item that is already saved. */
  readonly closeIcon = input<'close' | 'back'>('close');
  readonly closed = output<void>();

  protected readonly closeButton = computed(() =>
    this.closeIcon() === 'close'
      ? ({ icon: 'close', label: UI_TEXT.close } as const)
      : ({ icon: 'arrow_back', label: UI_TEXT.back } as const),
  );
}
