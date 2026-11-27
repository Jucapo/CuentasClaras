import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../../shared/ui/services/confirm.service';

/** A screen that can hold edits not saved yet (spec §13.5). */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Texts of the confirmation shown before discarding unsaved changes. */
export const UNSAVED_CHANGES_CONFIRM = {
  title: '¿Descartar los cambios?',
  message: 'Los cambios que hiciste no se han guardado.',
  confirmLabel: 'Descartar',
} as const;

/**
 * Asks before leaving a flow with unsaved changes, whatever the way out: close, back, Esc or the
 * system back button. Without changes it lets the user leave right away.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return inject(ConfirmService).confirm({ ...UNSAVED_CHANGES_CONFIRM, destructive: true });
};
