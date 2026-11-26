import { maxLength, required, schema, validate } from '@angular/forms/signals';
import {
  ACCOUNT_GROUP_CHOICES,
  ACCOUNT_KIND_OPTIONS,
  CreatableAccountGroup,
  NAME_MAX_LENGTH,
} from '../../../../core/config/catalog.constants';
import { Tables } from '../../../../core/supabase/database.types';
import {
  AccountKind,
  includeInTotalByDefault,
  toDisplayedBalance,
  toStoredBalance,
} from '../../../../domain/accounts/account-kinds';
import { IsoDate, isIsoDate, todayIsoDate } from '../../../../domain/dates/local-date';

/** Values edited by `cc-account-editor`; the balance is the amount the user sees (debts positive). */
export interface AccountFormValue {
  name: string;
  kind: AccountKind;
  currency: string;
  /** Minor units as typed: what the account has, or what is owed for debts. */
  balance: number | null;
  balanceDate: IsoDate;
  icon: string;
  /** Palette key; null only while nothing is picked. */
  color: string | null;
  includeInTotal: boolean;
  isPrivate: boolean;
  includeInSpaceByDefault: boolean;
  isDefault: boolean;
}

/** Account columns the form edits, ready for an insert or an update. */
export interface AccountFormRow {
  readonly name: string;
  readonly kind: AccountKind;
  readonly currency: string;
  readonly initial_balance: number;
  readonly initial_balance_date: IsoDate;
  readonly icon: string;
  readonly color: string;
  readonly include_in_total: boolean;
  readonly visibility: 'shared' | 'private';
  readonly include_in_space_by_default: boolean;
}

/** Validation messages of the account form. */
export const ACCOUNT_FORM_MESSAGES = {
  nameRequired: 'Ponle un nombre a la cuenta.',
  nameTooLong: `Usa máximo ${NAME_MAX_LENGTH.account} caracteres.`,
  balanceRequired: 'Escribe el saldo; puede ser 0.',
  dateRequired: 'Elige la fecha del saldo.',
  dateInFuture: 'La fecha del saldo no puede ser futura.',
  colorRequired: 'Elige un color.',
} as const;

/** Rules of the account form; apply it to the field that holds the values. */
export const accountFormSchema = schema<AccountFormValue>((path) => {
  required(path.name, { message: ACCOUNT_FORM_MESSAGES.nameRequired });
  validate(path.name, ({ value }) =>
    value().trim() ? undefined : { kind: 'blank', message: ACCOUNT_FORM_MESSAGES.nameRequired },
  );
  maxLength(path.name, NAME_MAX_LENGTH.account, { message: ACCOUNT_FORM_MESSAGES.nameTooLong });
  required(path.balance, { message: ACCOUNT_FORM_MESSAGES.balanceRequired });
  validate(path.balanceDate, ({ value }) => {
    const date = value();
    if (!isIsoDate(date)) {
      return { kind: 'required', message: ACCOUNT_FORM_MESSAGES.dateRequired };
    }
    // ISO dates compare as text.
    return date > todayIsoDate()
      ? { kind: 'future', message: ACCOUNT_FORM_MESSAGES.dateInFuture }
      : undefined;
  });
  required(path.color, { message: ACCOUNT_FORM_MESSAGES.colorRequired });
});

/** Icon, color and "include in total" a new account of a kind starts with. */
export function kindDefaults(
  kind: AccountKind,
): Pick<AccountFormValue, 'icon' | 'color' | 'includeInTotal'> {
  const { icon, color } = ACCOUNT_KIND_OPTIONS[kind];
  return { icon, color, includeInTotal: includeInTotalByDefault(kind) };
}

/**
 * Values after the kind changes: icon, color and "include in total" follow the new kind unless the
 * user changed them from the previous kind's defaults. The balance stays as the user sees it.
 */
export function applyKindDefaults(
  value: AccountFormValue,
  previousKind: AccountKind,
): AccountFormValue {
  const before = kindDefaults(previousKind);
  const after = kindDefaults(value.kind);
  return {
    ...value,
    icon: value.icon === before.icon ? after.icon : value.icon,
    color: value.color === before.color ? after.color : value.color,
    includeInTotal:
      value.includeInTotal === before.includeInTotal ? after.includeInTotal : value.includeInTotal,
  };
}

/** Starting values of a new account. */
export function newAccountFormValue(
  currency: string,
  today: IsoDate = todayIsoDate(),
  kind: AccountKind = 'bank',
): AccountFormValue {
  return {
    name: '',
    kind,
    currency,
    balance: 0,
    balanceDate: today,
    ...kindDefaults(kind),
    isPrivate: false,
    includeInSpaceByDefault: false,
    isDefault: false,
  };
}

/** Form values of a saved account; debts show what is owed as a positive amount. */
export function accountToFormValue(
  account: Pick<
    Tables<'accounts'>,
    | 'name'
    | 'kind'
    | 'currency'
    | 'initial_balance'
    | 'initial_balance_date'
    | 'icon'
    | 'color'
    | 'include_in_total'
    | 'visibility'
    | 'include_in_space_by_default'
  >,
  isDefault: boolean,
): AccountFormValue {
  return {
    name: account.name,
    kind: account.kind,
    currency: account.currency,
    balance: toDisplayedBalance(account.kind, account.initial_balance),
    balanceDate: account.initial_balance_date,
    icon: account.icon,
    color: account.color,
    includeInTotal: account.include_in_total,
    isPrivate: account.visibility === 'private',
    includeInSpaceByDefault: account.include_in_space_by_default,
    isDefault,
  };
}

/** Columns to save; debts are stored negative (spec §4.1). */
export function accountFormToRow(value: AccountFormValue, fallbackColor: string): AccountFormRow {
  return {
    name: value.name.trim(),
    kind: value.kind,
    currency: value.currency,
    initial_balance: toStoredBalance(value.kind, value.balance ?? 0),
    initial_balance_date: value.balanceDate,
    icon: value.icon,
    color: value.color ?? fallbackColor,
    include_in_total: value.includeInTotal,
    visibility: value.isPrivate ? 'private' : 'shared',
    // Only private accounts use it; shared ones keep the default.
    include_in_space_by_default: value.isPrivate && value.includeInSpaceByDefault,
  };
}

/** Group picked in "¿Qué vas a crear?", read from the `grupo` query param; Cuentas otherwise. */
export function accountGroupFromParam(param: string | null | undefined): CreatableAccountGroup {
  const groups = Object.keys(ACCOUNT_GROUP_CHOICES) as CreatableAccountGroup[];
  return groups.find((group) => ACCOUNT_GROUP_CHOICES[group].param === param) ?? 'accounts';
}

/** Kind a new account of `group` starts with; the user can change it in "Tipo". */
export function defaultKindFor(group: CreatableAccountGroup): AccountKind {
  return ACCOUNT_GROUP_CHOICES[group].defaultKind;
}
