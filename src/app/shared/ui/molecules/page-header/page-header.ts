import { Component, input } from '@angular/core';
import { LinkCommands } from '../../atoms/button/button';
import { IconButton } from '../../atoms/icon-button/icon-button';

/** Page title with an optional subtitle, a back link and a slot for actions. */
@Component({
  selector: 'cc-page-header',
  imports: [IconButton],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  /** Where the back arrow goes, for screens below a list. */
  readonly backLink = input<LinkCommands>();
  readonly backLabel = input('Volver');
}
