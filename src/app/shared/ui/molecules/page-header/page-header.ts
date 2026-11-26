import { Component, input } from '@angular/core';

/** Page title with an optional subtitle and a slot for actions. */
@Component({
  selector: 'cc-page-header',
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
