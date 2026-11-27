import { Component, computed, inject } from '@angular/core';
import { CategoriesService } from '../../../core/categories/categories.service';
import { Tag } from '../../../core/categories/category.models';
import { TagsService } from '../../../core/categories/tags.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { SpaceService } from '../../../core/spaces/space.service';
import { Button } from '../../../shared/ui/atoms/button/button';
import { IconButton } from '../../../shared/ui/atoms/icon-button/icon-button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { FALLBACK_COLOR } from '../../../shared/ui/colors/color-palette';
import { Disclosure } from '../../../shared/ui/molecules/disclosure/disclosure';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../../shared/ui/molecules/section/section';
import { TagList, TagListEntry } from '../../../shared/ui/organisms/tag-list/tag-list';
import {
  TagSheet,
  TagSheetData,
  TagSheetResult,
} from '../../../shared/ui/organisms/tag-sheet/tag-sheet';
import {
  newTagFormValue,
  TagFormValue,
} from '../../../shared/ui/organisms/tag-sheet/tag-sheet.model';
import { ConfirmService } from '../../../shared/ui/services/confirm.service';
import { useShortcuts } from '../../../shared/ui/services/keyboard-shortcuts';
import { OverlayService } from '../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../shared/ui/services/toast.service';

/**
 * Configuración → Etiquetas: the tags of the space and how many categories use each. Creating and
 * editing happen in a short sheet (spec §7).
 */
@Component({
  selector: 'app-tags-settings-page',
  imports: [PageHeader, IconButton, Button, Message, Section, Disclosure, TagList],
  templateUrl: './tags-settings-page.html',
  styleUrl: './tags-settings-page.scss',
})
export class TagsSettingsPage {
  private readonly tags = inject(TagsService);
  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.tags.loadError;
  protected readonly backLink = ['/', APP_PATHS.settings];

  protected readonly active = computed(() => this.tags.activeTags().map((tag) => this.entry(tag)));
  protected readonly archived = computed(() =>
    this.tags
      .tags()
      .filter((tag) => tag.archived_at)
      .map((tag) => ({ ...this.entry(tag), subtitle: 'Archivada', archived: true })),
  );
  protected readonly archivedLabel = computed(() => `Archivadas (${this.archived().length})`);
  protected readonly isEmpty = computed(() => this.tags.loaded() && this.active().length === 0);

  constructor() {
    useShortcuts({ n: () => void this.open(null) });
  }

  /** Opens the sheet of a tag, or of a new one with `null`. */
  protected async open(id: string | null): Promise<void> {
    if (!this.canEdit()) {
      return;
    }
    const tag = id ? (this.tags.find(id) ?? null) : null;
    const result = await this.overlay.open<TagSheetResult, TagSheetData>(TagSheet, {
      label: tag ? tag.name : 'Nueva etiqueta',
      autoFocus: tag ? undefined : 'input',
      data: {
        title: tag ? 'Etiqueta' : 'Nueva etiqueta',
        value: tag ? { name: tag.name, color: tag.color } : newTagFormValue(),
        actions: tag ? { archived: !!tag.archived_at, canDelete: true } : undefined,
        save: (value) => this.save(tag, value),
      },
    });
    if (!tag || !result || result === 'saved') {
      return;
    }
    if (result === 'delete') {
      await this.remove(tag);
    } else {
      const archived = await this.tags.setArchived(tag.id, result === 'archive');
      void this.toast.show(
        !archived.ok
          ? archived.message
          : result === 'archive'
            ? 'Etiqueta archivada.'
            : 'Etiqueta restaurada.',
      );
    }
  }

  private async save(tag: Tag | null, value: TagFormValue) {
    const values = { name: value.name.trim(), color: value.color ?? FALLBACK_COLOR };
    const result = tag ? await this.tags.update(tag.id, values) : await this.tags.create(values);
    if (result.ok) {
      void this.toast.show(tag ? 'Etiqueta guardada.' : 'Etiqueta creada.');
    }
    return result.ok ? ({ ok: true } as const) : result;
  }

  private async remove(tag: Tag): Promise<void> {
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
    const result = await this.tags.remove(tag.id);
    void this.toast.show(result.ok ? 'Etiqueta eliminada.' : result.message);
  }

  private entry(tag: Tag): TagListEntry {
    const uses = this.categories
      .categories()
      .filter((category) => category.default_tag_ids.includes(tag.id)).length;
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      subtitle:
        uses === 0
          ? undefined
          : `Por defecto en ${uses} ${uses === 1 ? 'categoría' : 'categorías'}`,
    };
  }
}
