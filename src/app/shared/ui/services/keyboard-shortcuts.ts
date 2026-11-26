import { Dialog } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { SHORTCUTS_STORAGE_KEY } from '../../../core/config/app.constants';
import { LayoutService } from './layout.service';

/**
 * A shortcut: a single letter (`n`), `Escape`, or `Mod+<letter>`, where Mod is Ctrl, or ⌘ on
 * Apple devices.
 */
export type ShortcutKey = string;

/** Handlers keyed by shortcut. */
export type ShortcutMap = Readonly<Record<ShortcutKey, () => void>>;

/** The parts of a keyboard event a shortcut looks at. */
export type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>;

const MOD_PREFIX = 'Mod+';

/** A single key without modifiers: it can be turned off (WCAG 2.1.4). */
export function isSingleKeyShortcut(shortcut: ShortcutKey): boolean {
  return shortcut.length === 1;
}

/** Whether the event is `shortcut`; letters ignore case, and single keys refuse modifiers. */
export function matchesShortcut(event: ShortcutEvent, shortcut: ShortcutKey): boolean {
  const key = event.key.toLowerCase();
  if (shortcut.startsWith(MOD_PREFIX)) {
    return (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      key === shortcut.slice(MOD_PREFIX.length).toLowerCase()
    );
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return key === shortcut.toLowerCase();
}

/** Whether the user is typing in `target`, where single keys must keep their meaning. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  // jsdom has no isContentEditable, so the attribute is checked too.
  if (target.isContentEditable || target.closest('[contenteditable="true"], [contenteditable=""]')) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    const nonTextTypes = ['button', 'checkbox', 'radio', 'range', 'reset', 'submit', 'color'];
    return !nonTextTypes.includes(target.type);
  }
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

interface Registration {
  readonly shortcuts: ShortcutMap;
}

/**
 * Keyboard shortcuts of the medium and expanded window classes (spec §13.5). The latest
 * registration wins, so the screen in front (a flow over its list) handles a key first. Nothing
 * runs while a dialog or sheet is open; single-key shortcuts can be turned off per device.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcuts {
  private readonly document = inject(DOCUMENT);
  private readonly layout = inject(LayoutService);
  private readonly dialogs = inject(Dialog);
  private readonly registrations: Registration[] = [];
  private listening = false;

  /** Single-key shortcuts (N, E) are on; stored on this device. */
  readonly singleKeyEnabled = signal(this.readPreference());

  /** Turns single-key shortcuts on or off on this device. */
  setSingleKeyEnabled(enabled: boolean): void {
    this.singleKeyEnabled.set(enabled);
    try {
      this.document.defaultView?.localStorage.setItem(SHORTCUTS_STORAGE_KEY, String(enabled));
    } catch {
      // Storage may be blocked (private mode); the preference then lasts for this visit.
    }
  }

  /** Registers `shortcuts` until `destroyRef` is destroyed. */
  register(shortcuts: ShortcutMap, destroyRef: DestroyRef): void {
    const registration: Registration = { shortcuts };
    this.registrations.push(registration);
    this.listen();
    destroyRef.onDestroy(() => {
      const index = this.registrations.indexOf(registration);
      if (index >= 0) {
        this.registrations.splice(index, 1);
      }
    });
  }

  /** Runs the handler for `event`, if any; exposed for tests. */
  handle(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.layout.isCompact() || this.dialogs.openDialogs.length > 0) {
      return;
    }
    const typing = isEditableTarget(event.target);
    for (let index = this.registrations.length - 1; index >= 0; index--) {
      const shortcuts = this.registrations[index].shortcuts;
      const shortcut = Object.keys(shortcuts).find((candidate) =>
        matchesShortcut(event, candidate),
      );
      if (shortcut === undefined) {
        continue;
      }
      if (isSingleKeyShortcut(shortcut) && (typing || !this.singleKeyEnabled())) {
        return;
      }
      // Ctrl/⌘+S would otherwise open the browser's "save page".
      event.preventDefault();
      shortcuts[shortcut]();
      return;
    }
  }

  private listen(): void {
    if (this.listening) {
      return;
    }
    this.listening = true;
    this.document.addEventListener('keydown', (event) => this.handle(event));
  }

  private readPreference(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(SHORTCUTS_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }
}

/** Registers shortcuts for the lifetime of the calling component; call it in a constructor. */
export function useShortcuts(shortcuts: ShortcutMap): void {
  inject(KeyboardShortcuts).register(shortcuts, inject(DestroyRef));
}
