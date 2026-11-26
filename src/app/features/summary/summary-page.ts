import { Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';

/** Reports for the selected period. */
@Component({
  selector: 'app-summary-page',
  imports: [PageHeader],
  templateUrl: './summary-page.html',
})
export class SummaryPage {}
