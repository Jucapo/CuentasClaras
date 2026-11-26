import { Dialog } from '@angular/cdk/dialog';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SHORTCUTS_STORAGE_KEY } from '../../../core/config/app.constants';
import {
  isEditableTarget,
  KeyboardShortcuts,
  matchesShortcut,
  ShortcutEvent,
} from './keyboard-shortcuts';
import { fixedLayout, LayoutService } from './layout.service';
import { WindowClass } from './window-class';

function key(key: string, modifiers: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

describe('matchesShortcut', () => {
  it('matches single letters in any case and without modifiers', () => {
    expect(matchesShortcut(key('n'), 'n')).toBe(true);
    expect(matchesShortcut(key('N'), 'n')).toBe(true);
    expect(matchesShortcut(key('n', { ctrlKey: true }), 'n')).toBe(false);
    expect(matchesShortcut(key('e'), 'n')).toBe(false);
  });

  it('matches Mod with Ctrl or ⌘, but not with Alt', () => {
    expect(matchesShortcut(key('s', { ctrlKey: true }), 'Mod+s')).toBe(true);
    expect(matchesShortcut(key('S', { metaKey: true }), 'Mod+s')).toBe(true);
    expect(matchesShortcut(key('s'), 'Mod+s')).toBe(false);
    expect(matchesShortcut(key('s', { ctrlKey: true, altKey: true }), 'Mod+s')).toBe(false);
  });

  it('matches named keys', () => {
    expect(matchesShortcut(key('Escape'), 'Escape')).toBe(true);
  });
});

describe('isEditableTarget', () => {
  it('is true for text inputs, text areas and editable content', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
  });

  it('is false for buttons, checkboxes and the page', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('KeyboardShortcuts', () => {
  const openDialogs: unknown[] = [];

  function setUp(windowClass: WindowClass = 'expanded'): KeyboardShortcuts {
    TestBed.configureTestingModule({
      providers: [
        { provide: LayoutService, useValue: fixedLayout(windowClass) },
        { provide: Dialog, useValue: { openDialogs } },
      ],
    });
    return TestBed.inject(KeyboardShortcuts);
  }

  function press(service: KeyboardShortcuts, init: KeyboardEventInit, target?: HTMLElement) {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
    if (target) {
      Object.defineProperty(event, 'target', { value: target });
    }
    service.handle(event);
    return event;
  }

  function destroyRef(): DestroyRef & { destroy: () => void } {
    const callbacks: (() => void)[] = [];
    return {
      onDestroy: (callback: () => void) => {
        callbacks.push(callback);
        return () => undefined;
      },
      destroyed: false,
      destroy: () => callbacks.forEach((callback) => callback()),
    } as unknown as DestroyRef & { destroy: () => void };
  }

  beforeEach(() => {
    localStorage.clear();
    openDialogs.length = 0;
  });

  it('runs the latest registration first, so the screen in front wins', () => {
    const service = setUp();
    const list = vi.fn();
    const flow = vi.fn();
    service.register({ Escape: list, n: list }, destroyRef());
    const flowRef = destroyRef();
    service.register({ Escape: flow }, flowRef);

    press(service, { key: 'Escape' });
    expect(flow).toHaveBeenCalledOnce();
    expect(list).not.toHaveBeenCalled();

    press(service, { key: 'n' });
    expect(list).toHaveBeenCalledOnce();

    flowRef.destroy();
    press(service, { key: 'Escape' });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('keeps single keys for typing, but saves and closes from a field', () => {
    const service = setUp();
    const create = vi.fn();
    const save = vi.fn();
    const close = vi.fn();
    service.register({ n: create, 'Mod+s': save, Escape: close }, destroyRef());
    const input = document.createElement('input');

    press(service, { key: 'n' }, input);
    const saving = press(service, { key: 's', ctrlKey: true }, input);
    press(service, { key: 'Escape' }, input);

    expect(create).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
    expect(saving.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it('turns single keys off on this device, but not Ctrl/⌘+S', () => {
    const service = setUp();
    const create = vi.fn();
    const save = vi.fn();
    service.register({ n: create, 'Mod+s': save }, destroyRef());

    service.setSingleKeyEnabled(false);
    press(service, { key: 'n' });
    press(service, { key: 's', metaKey: true });

    expect(create).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
    expect(localStorage.getItem(SHORTCUTS_STORAGE_KEY)).toBe('false');
  });

  it('reads the device preference and defaults to on', () => {
    expect(setUp().singleKeyEnabled()).toBe(true);
    TestBed.resetTestingModule();
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, 'false');
    expect(setUp().singleKeyEnabled()).toBe(false);
  });

  it('does nothing in the compact window class or while a dialog is open', () => {
    const compact = setUp('compact');
    const handler = vi.fn();
    compact.register({ Escape: handler }, destroyRef());
    press(compact, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const expanded = setUp('expanded');
    expanded.register({ Escape: handler }, destroyRef());
    openDialogs.push({});
    press(expanded, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();
  });
});
