import { inject, Injectable } from '@angular/core';
import { ActionResult } from '../../../core/action-result';
import { CategoriesService } from '../../../core/categories/categories.service';
import { CategoryKind, Tag } from '../../../core/categories/category.models';
import { TagsService } from '../../../core/categories/tags.service';
import { CATEGORY_KIND_LABELS } from '../../../core/config/catalog.constants';
import { SpaceService } from '../../../core/spaces/space.service';
import { FALLBACK_COLOR } from '../../../shared/ui/colors/color-palette';
import { CategoryChecklistNode } from '../../../shared/ui/organisms/category-checklist/category-checklist';
import { TagListEntry } from '../../../shared/ui/organisms/tag-list/tag-list';
import {
  TagSheet,
  TagSheetCategoryGroup,
  TagSheetData,
  TagSheetResult,
} from '../../../shared/ui/organisms/tag-sheet/tag-sheet';
import {
  newTagFormValue,
  TagFormValue,
} from '../../../shared/ui/organisms/tag-sheet/tag-sheet.model';
import { ConfirmService } from '../../../shared/ui/services/confirm.service';
import { OverlayService } from '../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../shared/ui/services/toast.service';

const CATEGORY_KINDS: readonly CategoryKind[] = ['expense', 'income'];

/** A tag as the lists show it, with how many categories it applies to by default. */
export function tagListEntry(tag: Tag, categoryIds: readonly string[]): TagListEntry {
  const uses = categoryIds.length;
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    subtitle:
      uses === 0 ? undefined : `Por defecto en ${uses} ${uses === 1 ? 'categoría' : 'categorías'}`,
  };
}

/**
 * Creating and editing a tag in its sheet (spec §7), with the categories where it applies by
 * default; archiving and deleting are confirmed here once the sheet closes (spec §13.5).
 * Configuración → Etiquetas and the setup wizard share it.
 */
@Injectable({ providedIn: 'root' })
export class TagFlow {
  private readonly tags = inject(TagsService);
  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  /** Opens the sheet of a tag, or of a new one with `null` (optionally with a suggested name). */
  async open(id: string | null, preset?: { name: string; color: string }): Promise<void> {
    if (!this.spaces.canEdit()) {
      return;
    }
    const tag = id ? this.tags.find(id) : null;
    const value: TagFormValue = tag
      ? { name: tag.name, color: tag.color, categoryIds: this.categories.categoriesWithTag(tag.id) }
      : newTagFormValue(preset);
    const result = await this.overlay.open<TagSheetResult, TagSheetData>(TagSheet, {
      label: tag ? tag.name : 'Nueva etiqueta',
      autoFocus: tag || preset ? undefined : 'input',
      data: {
        title: tag ? 'Etiqueta' : 'Nueva etiqueta',
        value,
        categories: this.categoryGroups(),
        actions: tag ? { archived: !!tag.archived_at, canDelete: true } : undefined,
        save: (changed) => this.save(tag, changed),
      },
    });
    if (!tag || !result || result === 'saved') {
      return;
    }
    if (result === 'delete') {
      await this.remove(tag);
      return;
    }
    const archived = await this.tags.setArchived(tag.id, result === 'archive');
    void this.toast.show(
      !archived.ok
        ? archived.message
        : result === 'archive'
          ? 'Etiqueta archivada.'
          : 'Etiqueta restaurada.',
    );
  }

  private async save(tag: Tag | null, value: TagFormValue): Promise<ActionResult> {
    const values = { name: value.name.trim(), color: value.color ?? FALLBACK_COLOR };
    let tagId = tag?.id ?? null;
    if (tag) {
      const saved = await this.tags.update(tag.id, values);
      if (!saved.ok) {
        return saved;
      }
    } else {
      const created = await this.tags.create(values);
      if (!created.ok) {
        return created;
      }
      tagId = created.value;
    }
    if (tagId) {
      const linked = await this.categories.setTagCategories(tagId, value.categoryIds);
      if (!linked.ok) {
        return linked;
      }
    }
    void this.toast.show(tag ? 'Etiqueta guardada.' : 'Etiqueta creada.');
    return { ok: true };
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

  /** Active categories of each kind, as the sheet's checklist shows them. */
  private categoryGroups(): TagSheetCategoryGroup[] {
    return CATEGORY_KINDS.map((kind) => ({
      label: CATEGORY_KIND_LABELS[kind],
      nodes: this.categories.tree(kind).map(({ category, children }): CategoryChecklistNode => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        children: children.map((child) => ({
          id: child.id,
          name: child.name,
          icon: child.icon,
          color: child.color,
        })),
      })),
    }));
  }
}
