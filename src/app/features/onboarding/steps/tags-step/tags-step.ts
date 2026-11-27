import { Component, computed, inject } from '@angular/core';
import { CategoriesService } from '../../../../core/categories/categories.service';
import { TagsService } from '../../../../core/categories/tags.service';
import { SUGGESTED_TAGS } from '../../../../core/config/category-template';
import { ONBOARDING_STEPS } from '../../../../core/onboarding/onboarding-steps';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { ColorSwatch } from '../../../../shared/ui/atoms/color-swatch/color-swatch';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { FormActions } from '../../../../shared/ui/molecules/form-actions/form-actions';
import { ListItem } from '../../../../shared/ui/molecules/list-item/list-item';
import { Section } from '../../../../shared/ui/molecules/section/section';
import { TagList } from '../../../../shared/ui/organisms/tag-list/tag-list';
import { useShortcuts } from '../../../../shared/ui/services/keyboard-shortcuts';
import { WizardStep } from '../../../../shared/ui/templates/wizard-step/wizard-step';
import { TagFlow, tagListEntry } from '../../../settings/tags/tag-flow';
import { StepActions } from '../../step-actions/step-actions';

/**
 * Wizard step 5 (optional), tags: created and edited in the tag sheet, which also says in which
 * categories each one applies by default. The category screen still does it the other way round.
 */
@Component({
  selector: 'app-tags-step',
  imports: [
    WizardStep,
    StepActions,
    TagList,
    Section,
    ListItem,
    ColorSwatch,
    FormActions,
    Button,
    Message,
  ],
  templateUrl: './tags-step.html',
})
export class TagsStep {
  private readonly tags = inject(TagsService);
  private readonly categories = inject(CategoriesService);
  private readonly tagFlow = inject(TagFlow);

  protected readonly step = ONBOARDING_STEPS[4];
  protected readonly loadError = this.tags.loadError;
  protected readonly entries = computed(() =>
    this.tags.activeTags().map((tag) => tagListEntry(tag, this.categories.categoriesWithTag(tag.id))),
  );
  protected readonly isEmpty = computed(() => this.tags.loaded() && this.entries().length === 0);
  /** Suggested tags that do not exist yet. */
  protected readonly suggestions = computed(() => {
    const names = new Set(this.tags.tags().map((tag) => tag.name.toLowerCase()));
    return SUGGESTED_TAGS.filter((tag) => !names.has(tag.name.toLowerCase()));
  });
  protected readonly nextLabel = computed(() => (this.isEmpty() ? 'Saltar' : 'Continuar'));

  constructor() {
    useShortcuts({ n: () => void this.open(null) });
  }

  protected open(id: string | null): Promise<void> {
    return this.tagFlow.open(id);
  }

  protected suggest(name: string): Promise<void> {
    const suggestion = SUGGESTED_TAGS.find((tag) => tag.name === name);
    return this.tagFlow.open(null, suggestion);
  }
}
