import { Component, computed, inject } from '@angular/core';
import { CategoriesService } from '../../../core/categories/categories.service';
import { TagsService } from '../../../core/categories/tags.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { SpaceService } from '../../../core/spaces/space.service';
import { Button } from '../../../shared/ui/atoms/button/button';
import { IconButton } from '../../../shared/ui/atoms/icon-button/icon-button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { Disclosure } from '../../../shared/ui/molecules/disclosure/disclosure';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../../shared/ui/molecules/section/section';
import { TagList } from '../../../shared/ui/organisms/tag-list/tag-list';
import { useShortcuts } from '../../../shared/ui/services/keyboard-shortcuts';
import { TagFlow, tagListEntry } from './tag-flow';

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
  private readonly tagFlow = inject(TagFlow);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.tags.loadError;
  protected readonly backLink = ['/', APP_PATHS.settings];

  protected readonly active = computed(() =>
    this.tags.activeTags().map((tag) => tagListEntry(tag, this.categories.categoriesWithTag(tag.id))),
  );
  protected readonly archived = computed(() =>
    this.tags
      .tags()
      .filter((tag) => tag.archived_at)
      .map((tag) => ({
        ...tagListEntry(tag, this.categories.categoriesWithTag(tag.id)),
        subtitle: 'Archivada',
        archived: true,
      })),
  );
  protected readonly archivedLabel = computed(() => `Archivadas (${this.archived().length})`);
  protected readonly isEmpty = computed(() => this.tags.loaded() && this.active().length === 0);

  constructor() {
    useShortcuts({ n: () => void this.open(null) });
  }

  /** Opens the sheet of a tag, or of a new one with `null`. */
  protected open(id: string | null): Promise<void> {
    return this.tagFlow.open(id);
  }
}
