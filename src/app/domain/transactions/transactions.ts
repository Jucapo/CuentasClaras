/** Kinds of movement (spec §4.2); they match the `transaction_type` enum of the database. */
export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment';

/** Direction of an adjustment; its amount stays positive. */
export type AdjustmentDirection = 'increase' | 'decrease';

/** What balance rules need from a movement. */
export interface BalanceMovement {
  readonly type: TransactionType;
  /** Minor units of the source account, always positive. */
  readonly amount: number;
  readonly account_id: string;
  readonly to_account_id: string | null;
  /** What arrived, in the destination currency, when it differs. */
  readonly to_amount: number | null;
  readonly adjustment_direction: AdjustmentDirection | null;
}

/**
 * How a movement changes the balance of one account, in that account's minor units (spec §4.1):
 * expenses and outgoing transfers subtract, incomes and incoming transfers add (what arrived), and
 * adjustments follow their direction. Zero for an account the movement does not touch.
 */
export function balanceDelta(movement: BalanceMovement, accountId: string): number {
  if (movement.type === 'transfer' && movement.to_account_id === accountId) {
    return movement.to_amount ?? movement.amount;
  }
  if (movement.account_id !== accountId) {
    return 0;
  }
  if (movement.type === 'income' || movement.adjustment_direction === 'increase') {
    return movement.amount;
  }
  return -movement.amount;
}

/**
 * The amount of a movement as the space sees it, in its own currency: expenses subtract, incomes
 * add and adjustments follow their direction. A transfer only moves money between accounts, so it
 * has no sign.
 */
export function spaceAmount(movement: BalanceMovement): number {
  if (movement.type === 'expense') {
    return -movement.amount;
  }
  if (movement.type === 'adjustment' && movement.adjustment_direction === 'decrease') {
    return -movement.amount;
  }
  return movement.amount;
}

/** What `isPrivateMovement` needs to know of an account the user can see. */
export interface VisibleAccount {
  readonly visibility: 'shared' | 'private';
}

/**
 * Whether a movement touches a private account: one of the user's (visible and private) or someone
 * else's (not visible), as source or as the destination of a transfer (spec §3.2).
 */
export function isPrivateMovement(
  movement: BalanceMovement,
  accountOf: (id: string) => VisibleAccount | null,
): boolean {
  const ids = [movement.account_id, ...(movement.to_account_id ? [movement.to_account_id] : [])];
  return ids.some((id) => accountOf(id)?.visibility !== 'shared');
}

/** The adjustment that takes an account to its real balance (both as stored); null if they match. */
export function adjustmentFor(
  storedBalance: number,
  realStoredBalance: number,
): { readonly direction: AdjustmentDirection; readonly amount: number } | null {
  const difference = realStoredBalance - storedBalance;
  if (difference === 0) {
    return null;
  }
  return difference > 0
    ? { direction: 'increase', amount: difference }
    : { direction: 'decrease', amount: -difference };
}
