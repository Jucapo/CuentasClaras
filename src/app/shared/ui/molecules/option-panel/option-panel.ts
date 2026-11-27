import { Component, computed, inject, signal } from '@angular/core';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { OverlayPanel } from '../overlay-panel/overlay-panel';

/** One choice of an option panel. */
export interface PanelOption<T> {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  /** Icon key shown in a badge with `color`. */
  readonly icon?: string;
  readonly color?: string | null;
  /** Heading the option is listed under; options of a group must be contiguous. */
  readonly group?: string;
}

/**
 * Data of `cc-option-panel`. `single` returns the picked value, `multiple` the picked values on
 * "Listo", and `action` the chosen option without marking any as current (e.g. "¿Qué vas a crear?").
 */
export interface OptionPanelData<T> {
  readonly title: string;
  readonly options: readonly PanelOption<T>[];
  readonly mode: 'single' | 'multiple' | 'action';
  readonly selected?: T | readonly T[];
  /** Shown when there are no options. */
  readonly emptyText?: string;
  /** Large badges, for a short list of main choices. */
  readonly prominent?: boolean;
}

interface OptionGroup<T> {
  readonly label: string | null;
  readonly options: readonly PanelOption<T>[];
}

/** Focused sheet or dialog to pick one or several options (spec §13.5). */
@Component({
  selector: 'cc-option-panel',
  imports: [OverlayPanel, IconBadge, Icon],
  templateUrl: './option-panel.html',
  styleUrl: './option-panel.scss',
})
export class OptionPanel<T> {
  protected readonly data = inject<OptionPanelData<T>>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<T | readonly T[]>>(OverlayHandle);

  protected readonly text = UI_TEXT;
  protected readonly picked = signal<readonly T[]>(initialSelection(this.data));
  protected readonly groups = computed(() => groupOptions(this.data.options));
  protected readonly role =
    this.data.mode === 'action' ? null : this.data.mode === 'single' ? 'radio' : 'checkbox';

  protected isPicked(option: PanelOption<T>): boolean {
    return this.data.mode !== 'action' && this.picked().includes(option.value);
  }

  protected choose(option: PanelOption<T>): void {
    if (this.data.mode !== 'multiple') {
      this.handle.close(option.value);
      return;
    }
    this.picked.update((values) =>
      values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value],
    );
  }

  protected done(): void {
    this.handle.close(this.picked());
  }

  protected close(): void {
    this.handle.close();
  }
}

function initialSelection<T>(data: OptionPanelData<T>): readonly T[] {
  if (data.selected === undefined) {
    return [];
  }
  return data.mode === 'multiple' ? (data.selected as readonly T[]) : [data.selected as T];
}

function groupOptions<T>(options: readonly PanelOption<T>[]): readonly OptionGroup<T>[] {
  const groups: { label: string | null; options: PanelOption<T>[] }[] = [];
  for (const option of options) {
    const label = option.group ?? null;
    const last = groups.at(-1);
    if (last && last.label === label) {
      last.options.push(option);
    } else {
      groups.push({ label, options: [option] });
    }
  }
  return groups;
}
