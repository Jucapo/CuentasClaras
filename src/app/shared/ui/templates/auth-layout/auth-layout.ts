import { Component } from '@angular/core';
import { Brand } from '../../molecules/brand/brand';

/** Centered card for the sign-in, sign-up and password screens. */
@Component({
  selector: 'cc-auth-layout',
  imports: [Brand],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {}
