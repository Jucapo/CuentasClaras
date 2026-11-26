import { actionFailed, ActionResult } from '../action-result';
import {
  dataErrorMessage,
  DataError,
  FOREIGN_KEY_VIOLATION,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';

/** Outcome of deleting a catalog row; `inUse` means it has movements and can only be archived. */
export type DeleteResult = ActionResult | { ok: false; message: string; inUse: true };

/** Maps the outcome of a delete to a result, with a specific message when the row is in use. */
export function deleteResult(
  error: DataError | null,
  status: number,
  deletedRows: number,
  inUseMessage: string,
): DeleteResult {
  if (error) {
    return error.code === FOREIGN_KEY_VIOLATION
      ? { ok: false, message: inUseMessage, inUse: true }
      : actionFailed(dataErrorMessage(error, status));
  }
  // RLS filters forbidden rows out instead of failing.
  return deletedRows > 0 ? { ok: true } : actionFailed(NOT_ALLOWED_MESSAGE);
}

/** Whether a failed delete can be solved by archiving instead. */
export function isInUse(result: DeleteResult): boolean {
  return !result.ok && 'inUse' in result;
}
