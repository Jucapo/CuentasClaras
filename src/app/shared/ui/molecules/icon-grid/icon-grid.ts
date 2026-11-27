import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';
import { TextField } from '../../atoms/text-field/text-field';
import { IconName } from '../../icons/icon-glyphs';
import { IconContext, PickableIcon, searchIcons, suggestIcons } from '../../icons/icon-search';
import { RECENT_ICONS } from '../../icons/recent-icons';
import { UI_TEXT } from '../../ui.constants';

/** A section of the grid: "Sugeridos" or a group of the catalog. */
interface IconSection {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly icons: readonly PickableIcon[];
}

const SUGGESTED_SECTION = { id: 'suggested', icon: 'auto_awesome' as IconName } as const;

/**
 * The icon catalog (spec §13.3): search and one continuous grid, "Sugeridos" first and then the
 * groups, with no sideways scrolling. A narrow container keeps a button with the visible group at
 * the top that opens the list of groups; a wide one shows that list beside the grid. Both mark the
 * group in view and jump to the one chosen.
 */
@Component({
  selector: 'cc-icon-grid',
  imports: [TextField, IconBadge, Icon, MatMenu, MatMenuItem, MatMenuTrigger],
  templateUrl: './icon-grid.html',
  styleUrl: './icon-grid.scss',
})
export class IconGrid {
  /** Selected icon key. */
  readonly value = model.required<string>();
  /** Palette key used to preview the icons. */
  readonly color = input<string | null>(null);
  /** What the icon is for; it decides the groups suggested. */
  readonly context = input<IconContext | null>(null);
  /** Name typed for the item; its words suggest icons. */
  readonly itemName = input('');

  private readonly recent = inject(RECENT_ICONS);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly toolbar = viewChild.required<ElementRef<HTMLElement>>('toolbar');
  private readonly sectionElements = viewChildren<ElementRef<HTMLElement>>('section');

  protected readonly text = UI_TEXT;
  protected readonly query = signal('');
  protected readonly searching = computed(() => this.query().trim() !== '');
  private readonly suggested = computed(() =>
    suggestIcons({ context: this.context(), name: this.itemName(), recent: this.recent() }),
  );
  protected readonly sections = computed<IconSection[]>(() => {
    const groups = searchIcons(this.query());
    const suggested = this.suggested();
    return this.searching() || suggested.length === 0
      ? groups
      : [{ ...SUGGESTED_SECTION, label: UI_TEXT.suggestedIcons, icons: suggested }, ...groups];
  });
  /** Group in view at the top of the grid. */
  private readonly visibleId = signal<string | null>(null);
  /** Group just jumped to; it stays marked while it is in view, even if the end stops it lower. */
  private jumpedTo: string | null = null;
  protected readonly current = computed(() => {
    const sections = this.sections();
    return sections.find((section) => section.id === this.visibleId()) ?? sections[0] ?? null;
  });

  constructor() {
    // Scroll events do not bubble; one capturing listener follows whichever ancestor scrolls.
    const onScroll = () => this.updateVisible();
    afterNextRender(() => {
      this.host.ownerDocument.addEventListener('scroll', onScroll, {
        capture: true,
        passive: true,
      });
    });
    inject(DestroyRef).onDestroy(() =>
      this.host.ownerDocument.removeEventListener('scroll', onScroll, { capture: true }),
    );
  }

  /** Scrolls the grid so the section starts right under the toolbar, and marks it. */
  protected jumpTo(id: string): void {
    const section = this.sectionElements().find(
      (element) => element.nativeElement.dataset['group'] === id,
    )?.nativeElement;
    const scroller = scrollParentOf(this.host);
    if (!section || !scroller) {
      return;
    }
    // Where the toolbar sticks, not where it is now: it stops moving once it reaches the top.
    const toolbar = this.toolbar().nativeElement;
    const stickyTop = Number.parseFloat(getComputedStyle(toolbar).top) || 0;
    const stuckBottom = scrollportTop(scroller) + stickyTop + toolbar.offsetHeight;
    scroller.scrollTop += section.getBoundingClientRect().top - stuckBottom;
    this.jumpedTo = id;
    this.visibleId.set(id);
  }

  private updateVisible(): void {
    // A couple of pixels of slack for fractional positions.
    const line = this.toolbar().nativeElement.getBoundingClientRect().bottom + 2;
    let visible: string | null = null;
    for (const element of this.sectionElements()) {
      // The last section whose start passed the toolbar is the one being read.
      if (element.nativeElement.getBoundingClientRect().top <= line) {
        visible = element.nativeElement.dataset['group'] ?? null;
      }
    }
    if (this.jumpedTo !== null) {
      const scroller = scrollParentOf(this.host);
      const atEnd =
        !!scroller && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      if (visible === this.jumpedTo || atEnd) {
        return;
      }
      this.jumpedTo = null;
    }
    this.visibleId.set(visible);
  }
}

/** Top of the visible area of a scroller, where sticky content sticks. */
function scrollportTop(scroller: Element): number {
  return scroller === scroller.ownerDocument.scrollingElement
    ? 0
    : scroller.getBoundingClientRect().top + scroller.clientTop;
}

/** The element itself or its nearest ancestor that scrolls vertically, else the page. */
function scrollParentOf(element: HTMLElement): Element | null {
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (
      (overflow === 'auto' || overflow === 'scroll') &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
  }
  return element.ownerDocument.scrollingElement;
}
