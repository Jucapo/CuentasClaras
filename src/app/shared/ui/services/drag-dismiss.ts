import { DestroyRef, Directive, DOCUMENT, ElementRef, inject, input } from '@angular/core';
import { DRAG_DISMISS } from '../ui.constants';
import { OverlayHandle } from './overlay.service';

/** Which way the overlay leaves: a sheet goes down, the drawer goes to the start edge. */
export type DragDismissDirection = 'down' | 'start';

const RETURN_CLASS = 'cc-drag-return';

/**
 * Dragging this element moves its overlay and, past a distance or fast enough, asks to close it
 * (spec §13.5): through `OverlayHandle.requestClose`, so an overlay with unsaved changes asks
 * first and slides back. The click that ends a drag does not count as a tap (`takeDragEnd`).
 *
 * The moves are followed on the document from the moment the finger goes down, since the first one
 * may already leave the element; the pointer is captured only once it is a drag, so a tap still
 * reaches the control under it.
 */
@Directive({
  selector: '[ccDragDismiss]',
  host: {
    '(pointerdown)': 'start($event)',
    '(click)': 'onClick($event)',
  },
})
export class DragDismiss {
  /** Which way the overlay leaves. */
  readonly direction = input<DragDismissDirection>('down', { alias: 'ccDragDismiss' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly handle = inject<OverlayHandle<unknown>>(OverlayHandle, { optional: true });
  private readonly rtl = this.document.dir === 'rtl';

  private pane: HTMLElement | null = null;
  private pointerId: number | null = null;
  private origin = 0;
  private startedAt = 0;
  private offset = 0;
  private dragging = false;
  private dropClick = false;

  private readonly onMove = (event: PointerEvent) => this.move(event);
  private readonly onUp = (event: PointerEvent) => this.end(event);
  private readonly onCancel = () => this.cancel();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopFollowing());
  }

  protected start(event: PointerEvent): void {
    if (!this.handle || !event.isPrimary || event.button !== 0) {
      return;
    }
    this.pane = this.host.closest<HTMLElement>('.cdk-overlay-pane');
    if (!this.pane) {
      return;
    }
    this.pointerId = event.pointerId;
    this.origin = this.coordinate(event);
    this.startedAt = event.timeStamp;
    this.offset = 0;
    this.dragging = false;
    this.dropClick = false;
    this.document.addEventListener('pointermove', this.onMove);
    this.document.addEventListener('pointerup', this.onUp);
    this.document.addEventListener('pointercancel', this.onCancel);
  }

  // The flag stays for a click listener of the same element (takeDragEnd): Angular calls the
  // listeners of one element in its own order, which stopImmediatePropagation does not stop.
  protected onClick(event: MouseEvent): void {
    if (this.dropClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /** Whether the click being handled ends a drag, so it must not count as a tap. */
  takeDragEnd(): boolean {
    const dragged = this.dropClick;
    this.dropClick = false;
    return dragged;
  }

  private move(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId || !this.pane) {
      return;
    }
    // Only toward the way out: a sheet never moves up, the drawer never opens wider.
    const travelled = Math.max(0, this.distance(event));
    if (!this.dragging && travelled < DRAG_DISMISS.slopPx) {
      return;
    }
    if (!this.dragging) {
      this.dragging = true;
      this.startedAt = event.timeStamp;
      this.host.setPointerCapture(event.pointerId);
    }
    this.offset = travelled;
    this.pane.classList.remove(RETURN_CLASS);
    this.pane.style.transform = this.translate(travelled);
  }

  private end(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const pane = this.pane;
    const dragged = this.dragging;
    this.reset();
    if (!pane || !dragged || !this.handle) {
      return;
    }
    this.dropClick = true;
    const size = this.direction() === 'down' ? pane.offsetHeight : pane.offsetWidth;
    const threshold = Math.min(size * DRAG_DISMISS.distanceRatio, DRAG_DISMISS.maxDistancePx);
    const elapsed = Math.max(1, event.timeStamp - this.startedAt);
    const fast =
      this.offset >= DRAG_DISMISS.flickMinPx &&
      this.offset / elapsed >= DRAG_DISMISS.velocityPxPerMs;
    // Closing keeps the pane where the finger left it, and the exit animation goes on from there.
    if ((this.offset >= threshold || fast) && this.handle.requestClose()) {
      return;
    }
    this.slideBack(pane);
  }

  private cancel(): void {
    const pane = this.pane;
    const dragged = this.dragging;
    this.reset();
    if (pane && dragged) {
      this.slideBack(pane);
    }
  }

  private reset(): void {
    this.stopFollowing();
    if (this.pointerId !== null && this.host.hasPointerCapture(this.pointerId)) {
      this.host.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.pane = null;
    this.dragging = false;
  }

  private stopFollowing(): void {
    this.document.removeEventListener('pointermove', this.onMove);
    this.document.removeEventListener('pointerup', this.onUp);
    this.document.removeEventListener('pointercancel', this.onCancel);
  }

  private slideBack(pane: HTMLElement): void {
    pane.classList.add(RETURN_CLASS);
    pane.style.transform = '';
    pane.addEventListener('transitionend', () => pane.classList.remove(RETURN_CLASS), {
      once: true,
    });
  }

  private coordinate(event: PointerEvent): number {
    return this.direction() === 'down' ? event.clientY : event.clientX;
  }

  /** How far the pointer went toward the way out. */
  private distance(event: PointerEvent): number {
    const delta = this.coordinate(event) - this.origin;
    if (this.direction() === 'down') {
      return delta;
    }
    return this.rtl ? delta : -delta;
  }

  private translate(distance: number): string {
    if (this.direction() === 'down') {
      return `translateY(${distance}px)`;
    }
    return `translateX(${this.rtl ? distance : -distance}px)`;
  }
}
