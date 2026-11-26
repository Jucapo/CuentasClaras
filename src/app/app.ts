import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root component: hosts the router outlet. */
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {}
