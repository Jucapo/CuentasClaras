import { Component, input, output } from '@angular/core';
import { Amount } from '../../atoms/amount/amount';
import { LinkCommands } from '../../atoms/button/button';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { ListItem } from '../list-item/list-item';

/** An account in a list: badge, name, notes (private, default…) and its balance. */
@Component({
  selector: 'cc-account-row',
  imports: [ListItem, IconBadge, Amount],
  templateUrl: './account-row.html',
  host: { role: 'listitem' },
})
export class AccountRow {
  readonly name = input.required<string>();
  readonly icon = input.required<string>();
  readonly color = input.required<string>();
  /** Balance in minor units. */
  readonly balance = input.required<number>();
  readonly currency = input.required<string>();
  /** Short notes under the name, e.g. "Privada · Predeterminada". */
  readonly notes = input<string>();
  readonly link = input<LinkCommands>();
  /** Without a link, a button that emits `activate`, e.g. to pick the account. */
  readonly actionable = input(false);
  readonly archived = input(false);
  readonly activate = output<void>();
  /** Its detail is open next to the list. */
  readonly selected = input(false);
}
