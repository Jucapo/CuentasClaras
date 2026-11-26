/** Outcome of a user action, with a user-facing message on failure. */
export type ActionResult = { ok: true } | { ok: false; message: string };

/** Outcome of an action that produces a value, with a user-facing message on failure. */
export type DataResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** The successful `ActionResult`. */
export const ACTION_OK: ActionResult = { ok: true };

/** Builds a failed result with a user-facing message. */
export function actionFailed(message: string): { ok: false; message: string } {
  return { ok: false, message };
}
