import { Component, computed, inject, input } from '@angular/core';
import { LayoutService } from '../../../shared/ui/services/layout.service';
import { WindowClass } from '../../../shared/ui/services/window-class';

/**
 * Catalog only: the content sees `windowClass` instead of the real window, so a template can be
 * shown in each window class inside a small frame.
 */
@Component({
  selector: 'app-fixed-layout',
  templateUrl: './fixed-layout.html',
  styleUrl: './fixed-layout.scss',
  providers: [
    {
      provide: LayoutService,
      useFactory: (): Pick<LayoutService, 'windowClass' | 'isCompact' | 'isExpanded'> => {
        const host = inject(FixedLayout);
        return {
          windowClass: host.windowClass,
          isCompact: computed(() => host.windowClass() === 'compact'),
          isExpanded: computed(() => host.windowClass() === 'expanded'),
        };
      },
    },
  ],
})
export class FixedLayout {
  readonly windowClass = input.required<WindowClass>();
}
