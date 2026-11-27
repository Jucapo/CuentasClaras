import {
  DestroyRef,
  Directive,
  inject,
  Injectable,
  signal,
  TemplateRef,
  WritableSignal,
} from '@angular/core';

/** Where a screen puts something in the app shell (spec §7). */
type ScreenSlot = 'action' | 'bar' | 'fab';

/**
 * What the screen on show puts in the app shell, which keeps it fixed while the content scrolls:
 * its action on the right of the header (the pencil of Categorías, the search of Transacciones),
 * its own second row instead of the period (the tabs of Cuentas) and its floating button.
 */
@Injectable({ providedIn: 'root' })
export class ScreenChrome {
  private readonly slots: Record<ScreenSlot, WritableSignal<TemplateRef<unknown> | null>> = {
    action: signal(null),
    bar: signal(null),
    fab: signal(null),
  };

  /** The action of the screen, on the right of the header. */
  readonly action = this.slots.action.asReadonly();
  /** The second row of the header, instead of the period selector. */
  readonly bar = this.slots.bar.asReadonly();
  /** The floating button of the screen, above the bottom navigation. */
  readonly fab = this.slots.fab.asReadonly();

  /** Registers a template while its screen lives; a newer screen replaces it. */
  attach(slot: ScreenSlot, template: TemplateRef<unknown>, destroyRef: DestroyRef): void {
    this.slots[slot].set(template);
    // The next screen attaches before this one is destroyed: only clear what is still ours.
    destroyRef.onDestroy(() => {
      if (this.slots[slot]() === template) {
        this.slots[slot].set(null);
      }
    });
  }
}

/** The action of a screen in the header: `<ng-template ccScreenAction>…</ng-template>`. */
@Directive({ selector: 'ng-template[ccScreenAction]' })
export class ScreenAction {
  constructor() {
    inject(ScreenChrome).attach('action', inject(TemplateRef), inject(DestroyRef));
  }
}

/** The second row of the header for a screen: `<ng-template ccScreenBar>…</ng-template>`. */
@Directive({ selector: 'ng-template[ccScreenBar]' })
export class ScreenBar {
  constructor() {
    inject(ScreenChrome).attach('bar', inject(TemplateRef), inject(DestroyRef));
  }
}

/** The floating button of a screen: `<ng-template ccScreenFab>…</ng-template>`. */
@Directive({ selector: 'ng-template[ccScreenFab]' })
export class ScreenFab {
  constructor() {
    inject(ScreenChrome).attach('fab', inject(TemplateRef), inject(DestroyRef));
  }
}
