import { Component } from '@angular/core';
import { APP_BRAND_ICON, APP_NAME } from '../../../../core/config/app.constants';
import { Icon } from '../../atoms/icon/icon';

/** Product logo: brand icon and name. */
@Component({
  selector: 'cc-brand',
  imports: [Icon],
  templateUrl: './brand.html',
  styleUrl: './brand.scss',
})
export class Brand {
  protected readonly name = APP_NAME;
  protected readonly icon = APP_BRAND_ICON;
}
