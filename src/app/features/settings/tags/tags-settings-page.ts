import { Component, computed, inject } from '@angular/core';
import { CategoriesService } from '../../../core/categories/categories.service';
import { Tag } from '../../../core/categories/category.models';
import { TagsService } from '../../../core/categories/tags.service';
import { APP_PATHS, NEW_ITEM_PATH, SETTINGS_PATHS } from '../../../core/routing/app-paths';
import { SpaceService } from '../../../core/spaces/space.service';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../../shared/ui/molecules/section/section';
import { TagList, TagListEntry } from '../../../shared/ui/organisms/tag-list/tag-list';

/** Configuración → Etiquetas: the tags of the space and how many categories use each. */
@Component({
  selector: 'app-tags-settings-page',
  imports: [PageHeader, Button, Message, Section, TagList],
  templateUrl: './tags-settings-page.html',
  styleUrl: './tags-settings-page.scss',
})
export class TagsSettingsPage {
  private readonly tags = inject(TagsService);
  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.tags.loadError;
  protected readonly backLink = ['/', APP_PATHS.settings];
  private readonly listPath = ['/', APP_PATHS.settings, SETTINGS_PATHS.tags];
  protected readonly newLink = [...this.listPath, NEW_ITEM_PATH];

  protected readonly active = computed(() =>
    this.tags.activeTags().map((tag) => this.entry(tag)),
  );
  protected readonly archived = computed(() =>
    this.tags
      .tags()
      .filter((tag) => tag.archived_at)
      .map((tag) => ({ ...this.entry(tag), subtitle: 'Archivada', archived: true })),
  );
  protected readonly isEmpty = computed(() => this.tags.loaded() && this.active().length === 0);

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
      link: [...this.listPath, tag.id],
    };
  }
}
