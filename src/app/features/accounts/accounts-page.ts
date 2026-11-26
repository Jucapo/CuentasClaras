import { Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';

/** Accounts, savings, debts and net worth. */
@Component({
  selector: 'app-accounts-page',
  imports: [PageHeader],
  templateUrl: './accounts-page.html',
})
export class AccountsPage {}
