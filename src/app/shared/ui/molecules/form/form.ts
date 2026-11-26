import { Component, input } from '@angular/core';
import { FieldTree, FormRoot } from '@angular/forms/signals';

/** Form element bound to a Signal Forms tree: submits through its `submission` action. */
@Component({
  selector: 'cc-form',
  imports: [FormRoot],
  templateUrl: './form.html',
  styleUrl: './form.scss',
})
export class Form<T> {
  readonly form = input.required<FieldTree<T>>();
  /** Accessible name for the form, when the page has more than one. */
  readonly label = input<string>();
}
