import { Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';

/** Transaction list grouped by day. */
@Component({
  selector: 'app-transactions-page',
  imports: [PageHeader],
  templateUrl: './transactions-page.html',
})
export class TransactionsPage {}
