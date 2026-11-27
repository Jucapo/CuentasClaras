import { Signal } from '@angular/core';

/** A screen shown in the detail pane of Cuentas: an account's detail or its edit flow. */
export interface AccountPane {
  /** The account it shows; null while creating one. */
  readonly accountId: Signal<string | null>;
}

/** Whether a routed component is an account pane, without importing its class. */
export function isAccountPane(component: unknown): component is AccountPane {
  return typeof component === 'object' && component !== null && 'accountId' in component;
}
