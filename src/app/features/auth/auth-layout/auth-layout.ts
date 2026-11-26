import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { APP_NAME } from '../../../core/config/app.constants';

/** Centered card that hosts the sign-in, sign-up and password pages. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, MatIcon],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  protected readonly appName = APP_NAME;
}
