import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthLayout } from '../../../shared/ui/templates/auth-layout/auth-layout';
import { AuthBrand } from './auth-brand';

/** Route host of the auth screens: renders them inside the auth layout template. */
@Component({
  selector: 'app-auth-frame',
  imports: [RouterOutlet, AuthLayout],
  templateUrl: './auth-frame.html',
})
export class AuthFrame {
  protected readonly brand = inject(AuthBrand);
}
