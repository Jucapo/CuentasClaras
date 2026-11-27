import { maxLength, schema, validate } from '@angular/forms/signals';
import { TRANSACTION_LIMITS } from '../../../../core/config/transaction.constants';
import { TransactionEntry } from '../../../../core/transactions/transaction.models';
import { IsoDate, isIsoDate } from '../../../../domain/dates/local-date';
import { AmountExpression, evaluateExpression } from '../../../../domain/money/amount-expression';
import { currencyMinorUnits } from '../../../../domain/money/currencies';
import { AdjustmentDirection, TransactionType } from '../../../../domain/transactions/transactions';

/** An account the quick entry can use. */
export interface QuickEntryAccount {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  /** Credit cards ask for installments (spec §5.1 c). */
  readonly isCard: boolean;
  readonly isPrivate: boolean;
  readonly includeInSpaceByDefault: boolean;
  /** Group label for the selector, e.g. Cuentas or Deudas. */
  readonly group: string;
}

/** A category or subcategory with the tags it applies by default (spec §4.3). */
export interface QuickEntryCategory {
  readonly id: string;
  readonly name: string;
  readonly defaultTagIds: readonly string[];
}

/** Values edited by `cc-quick-entry`. */
export interface QuickEntryValue {
  type: TransactionType;
  /** What was typed on the keypad for the amount of the source account. */
  expression: AmountExpression;
  /** What arrived, typed for a transfer to another currency. */
  toExpression: AmountExpression;
  /** The category or one of its subcategories. */
  categoryId: string | null;
  accountId: string;
  /** Destination of a transfer; empty until one is picked. */
  toAccountId: string;
  date: IsoDate;
  tagIds: readonly string[];
  note: string;
  includeInSpace: boolean;
  installments: number;
  /** Monthly rate of the installments, in percent; null while empty. */
  monthlyRatePercent: number | null;
  adjustmentDirection: AdjustmentDirection;
}

/** What the rules need besides the values. */
export interface QuickEntryContext {
  readonly accounts: readonly QuickEntryAccount[];
}

/** Validation messages of the quick entry. */
export const QUICK_ENTRY_MESSAGES = {
  amountRequired: 'Escribe un monto mayor que cero.',
  toAccountRequired: 'Elige la cuenta destino.',
  sameAccount: 'Elige una cuenta distinta de la de origen.',
  toAmountRequired: 'Escribe cuánto llegó a la cuenta destino.',
  dateRequired: 'Elige la fecha.',
  installments: `Las cuotas van de 1 a ${TRANSACTION_LIMITS.maxInstallments}.`,
  rateRequired: 'Escribe la tasa mensual; 0 si no tiene interés.',
  rateTooHigh: `La tasa mensual debe ser menor que ${TRANSACTION_LIMITS.maxMonthlyRatePercent} %.`,
  noteTooLong: `Usa máximo ${TRANSACTION_LIMITS.noteMaxLength} caracteres.`,
} as const;

function accountOf(context: QuickEntryContext, id: string | null): QuickEntryAccount | null {
  return context.accounts.find((account) => account.id === id) ?? null;
}

/** Minor units of the amount typed for the source account. */
export function entryAmount(value: QuickEntryValue, context: QuickEntryContext): number {
  const currency = accountOf(context, value.accountId)?.currency ?? '';
  return evaluateExpression(value.expression, currencyMinorUnits(currency));
}

/** Whether a transfer goes to an account in another currency, so it needs what arrived. */
export function needsToAmount(value: QuickEntryValue, context: QuickEntryContext): boolean {
  if (value.type !== 'transfer') {
    return false;
  }
  const source = accountOf(context, value.accountId);
  const destination = accountOf(context, value.toAccountId);
  return !!source && !!destination && source.currency !== destination.currency;
}

/** Whether the entry asks for installments: expenses paid with a credit card. */
export function asksInstallments(value: QuickEntryValue, context: QuickEntryContext): boolean {
  return value.type === 'expense' && !!accountOf(context, value.accountId)?.isCard;
}

/** Whether "incluir en el espacio" applies: expenses and incomes of a private account. */
export function asksIncludeInSpace(value: QuickEntryValue, context: QuickEntryContext): boolean {
  return (
    (value.type === 'expense' || value.type === 'income') &&
    !!accountOf(context, value.accountId)?.isPrivate
  );
}

/** Rules of the quick entry (spec §4.2, §5.1 c). */
export function quickEntrySchema(context: QuickEntryContext) {
  return schema<QuickEntryValue>((path) => {
    validate(path.expression, ({ valueOf }) =>
      entryAmount(valueOf(path), context) > 0
        ? undefined
        : { kind: 'amount', message: QUICK_ENTRY_MESSAGES.amountRequired },
    );
    validate(path.toAccountId, ({ value, valueOf }) => {
      if (valueOf(path.type) !== 'transfer') {
        return undefined;
      }
      if (!value()) {
        return { kind: 'required', message: QUICK_ENTRY_MESSAGES.toAccountRequired };
      }
      return value() === valueOf(path.accountId)
        ? { kind: 'same', message: QUICK_ENTRY_MESSAGES.sameAccount }
        : undefined;
    });
    validate(path.toExpression, ({ value, valueOf }) => {
      const entry = valueOf(path);
      if (!needsToAmount(entry, context)) {
        return undefined;
      }
      const currency = accountOf(context, entry.toAccountId)?.currency ?? '';
      return evaluateExpression(value(), currencyMinorUnits(currency)) > 0
        ? undefined
        : { kind: 'amount', message: QUICK_ENTRY_MESSAGES.toAmountRequired };
    });
    validate(path.date, ({ value }) =>
      isIsoDate(value())
        ? undefined
        : { kind: 'required', message: QUICK_ENTRY_MESSAGES.dateRequired },
    );
    validate(path.installments, ({ value, valueOf }) => {
      if (!asksInstallments(valueOf(path), context)) {
        return undefined;
      }
      const installments = value();
      return Number.isInteger(installments) &&
        installments >= 1 &&
        installments <= TRANSACTION_LIMITS.maxInstallments
        ? undefined
        : { kind: 'installments', message: QUICK_ENTRY_MESSAGES.installments };
    });
    validate(path.monthlyRatePercent, ({ value, valueOf }) => {
      const entry = valueOf(path);
      if (!asksInstallments(entry, context) || entry.installments <= 1) {
        return undefined;
      }
      const rate = value();
      if (rate === null) {
        return { kind: 'required', message: QUICK_ENTRY_MESSAGES.rateRequired };
      }
      return rate < TRANSACTION_LIMITS.maxMonthlyRatePercent
        ? undefined
        : { kind: 'max', message: QUICK_ENTRY_MESSAGES.rateTooHigh };
    });
    maxLength(path.note, TRANSACTION_LIMITS.noteMaxLength, {
      message: QUICK_ENTRY_MESSAGES.noteTooLong,
    });
  });
}

/** The movement to save, with only what applies to its type (spec §4.2). */
export function toTransactionEntry(
  id: string,
  value: QuickEntryValue,
  context: QuickEntryContext,
): TransactionEntry {
  const categorized = value.type === 'expense' || value.type === 'income';
  const installments = asksInstallments(value, context) ? value.installments : 1;
  const destination = accountOf(context, value.toAccountId);
  return {
    id,
    type: value.type,
    date: value.date,
    amount: entryAmount(value, context),
    accountId: value.accountId,
    categoryId: categorized ? value.categoryId : null,
    toAccountId: value.type === 'transfer' && value.toAccountId ? value.toAccountId : null,
    toAmount: needsToAmount(value, context)
      ? evaluateExpression(value.toExpression, currencyMinorUnits(destination?.currency ?? ''))
      : null,
    adjustmentDirection: value.type === 'adjustment' ? value.adjustmentDirection : null,
    note: value.note.trim(),
    includeInSpace: asksIncludeInSpace(value, context) ? value.includeInSpace : false,
    tagIds: categorized ? value.tagIds : [],
    installments,
    monthlyRate: installments > 1 ? (value.monthlyRatePercent ?? 0) / 100 : 0,
  };
}

/** Tags a category applies by default: its own plus those of the chosen subcategory (spec §4.3). */
export function defaultTagIds(
  categoryId: string | null,
  category: QuickEntryCategory | null,
  subcategories: readonly QuickEntryCategory[],
): string[] {
  const chosen = subcategories.find((subcategory) => subcategory.id === categoryId);
  return [...new Set([...(category?.defaultTagIds ?? []), ...(chosen?.defaultTagIds ?? [])])];
}

/** "Incluir en el espacio" a new movement of an account starts with (spec §3.2). */
export function includeInSpaceDefault(account: QuickEntryAccount | null): boolean {
  return !!account?.isPrivate && account.includeInSpaceByDefault;
}

/** Whether two sets of values are the same entry; the order of the tags does not matter. */
export function sameQuickEntry(first: QuickEntryValue, second: QuickEntryValue): boolean {
  const keys = Object.keys(first) as (keyof QuickEntryValue)[];
  return keys.every((key) => {
    if (key === 'tagIds') {
      const tags = new Set(first.tagIds);
      return tags.size === new Set(second.tagIds).size && second.tagIds.every((id) => tags.has(id));
    }
    return first[key] === second[key];
  });
}
