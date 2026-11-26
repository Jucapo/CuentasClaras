import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { apply, disabled, form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { isInUse } from '../../../../core/catalogs/catalog-result';
import { CategoriesService } from '../../../../core/categories/categories.service';
import { TagsService } from '../../../../core/categories/tags.service';
import { APP_PATHS, SETTINGS_PATHS } from '../../../../core/routing/app-paths';
import { SpaceService } from '../../../../core/spaces/space.service';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { FALLBACK_COLOR } from '../../../../shared/ui/colors/color-palette';
import { FormActions } from '../../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../../shared/ui/molecules/page-header/page-header';
import { TagForm } from '../../../../shared/ui/organisms/tag-form/tag-form';
import {
  newTagFormValue,
  tagFormSchema,
  TagFormValue,
} from '../../../../shared/ui/organisms/tag-form/tag-form.model';
import { ConfirmService } from '../../../../shared/ui/services/confirm.service';
import { ToastService } from '../../../../shared/ui/services/toast.service';

/** Creates a tag, or edits, archives and deletes one. */
@Component({
  selector: 'app-tag-edit-page',
  imports: [PageHeader, Form, FormActions, Button, Message, TagForm],
  templateUrl: './tag-edit-page.html',
  styleUrl: './tag-edit-page.scss',
})
export class TagEditPage {
  /** Route param; absent when creating. */
  readonly id = input<string>();

  private readonly tags = inject(TagsService);
  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly backLink = ['/', APP_PATHS.settings, SETTINGS_PATHS.tags];
  protected readonly existing = computed(() => {
    const id = this.id();
    return id ? (this.tags.tags().find((tag) => tag.id === id) ?? null) : null;
  });
  protected readonly notFound = computed(
    () => !!this.id() && this.tags.loaded() && !this.existing(),
  );
  protected readonly archived = computed(() => !!this.existing()?.archived_at);
  protected readonly title = computed(() =>
    this.id() ? (this.existing()?.name ?? 'Etiqueta') : 'Nueva etiqueta',
  );

  private readonly model = linkedSignal<TagFormValue>(() => {
    const tag = this.existing();
    return tag ? { name: tag.name, color: tag.color } : newTagFormValue();
  });
  protected readonly form = form(
    this.model,
    (path) => {
      apply(path, tagFormSchema);
      disabled(path, () => !this.canEdit());
    },
    { submission: { action: () => this.save() } },
  );

  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly inUse = signal(false);
  protected readonly busy = signal(false);

  protected async toggleArchived(): Promise<void> {
    const tag = this.existing();
    if (!tag) {
      return;
    }
    this.busy.set(true);
    const result = await this.tags.setArchived(tag.id, !tag.archived_at);
    this.busy.set(false);
    if (!result.ok) {
      this.actionError.set(result.message);
      return;
    }
    this.inUse.set(false);
    this.actionError.set(null);
    void this.toast.show(tag.archived_at ? 'Etiqueta restaurada.' : 'Etiqueta archivada.');
    if (!tag.archived_at) {
      await this.router.navigate(this.backLink);
    }
  }

  protected async remove(): Promise<void> {
    const tag = this.existing();
    if (!tag) {
      return;
    }
    const usedBy = this.categories
      .categories()
      .filter((category) => category.default_tag_ids.includes(tag.id))
      .map((category) => category.name);
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar ${tag.name}?`,
      message:
        usedBy.length === 0
          ? 'Se elimina para siempre. Si solo quieres dejar de ofrecerla, archívala.'
          : 'También se quita de las etiquetas por defecto de:',
      details: usedBy,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    const result = await this.tags.remove(tag.id);
    this.busy.set(false);
    if (!result.ok) {
      this.actionError.set(result.message);
      this.inUse.set(isInUse(result));
      return;
    }
    void this.toast.show('Etiqueta eliminada.');
    await this.router.navigate(this.backLink);
  }

  private async save(): Promise<void> {
    this.error.set(null);
    const { name, color } = this.model();
    const values = { name: name.trim(), color: color ?? FALLBACK_COLOR };
    const tag = this.existing();
    const result = tag ? await this.tags.update(tag.id, values) : await this.tags.create(values);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    void this.toast.show(tag ? 'Etiqueta guardada.' : 'Etiqueta creada.');
    await this.router.navigate(this.backLink);
  }
}
