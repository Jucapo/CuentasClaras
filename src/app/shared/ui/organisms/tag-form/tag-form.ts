import { Component, input } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { TextField } from '../../atoms/text-field/text-field';
import { ColorPicker } from '../../molecules/color-picker/color-picker';
import { TagFormValue } from './tag-form.model';

/** Fields of a tag (spec §4.4); validate the tree with `tagFormSchema`. */
@Component({
  selector: 'cc-tag-form',
  imports: [FormField, TextField, ColorPicker],
  templateUrl: './tag-form.html',
  styleUrl: './tag-form.scss',
})
export class TagForm {
  readonly fields = input.required<FieldTree<TagFormValue>>();
}
