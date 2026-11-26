import { Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';

/** Spent vs. budgeted per category. */
@Component({
  selector: 'app-budget-page',
  imports: [PageHeader],
  templateUrl: './budget-page.html',
})
export class BudgetPage {}
