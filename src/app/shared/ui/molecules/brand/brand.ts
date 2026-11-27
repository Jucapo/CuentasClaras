import { Component } from '@angular/core';
import { APP_LOGO_PATH, APP_NAME } from '../../../../core/config/app.constants';

/** Product logo and name. */
@Component({
  selector: 'cc-brand',
  templateUrl: './brand.html',
  styleUrl: './brand.scss',
})
export class Brand {
  protected readonly name = APP_NAME;
  protected readonly logo = APP_LOGO_PATH;
}
