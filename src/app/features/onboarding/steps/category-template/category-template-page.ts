import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoriesService } from '../../../../core/categories/categories.service';
import { CategoryKind } from '../../../../core/categories/category.models';
import { CATEGORY_TEMPLATE } from '../../../../core/config/category-template';
import { checklistIds } from '../../../../domain/categories/category-checklist';
import { pickTemplate, templateNodes } from '../../../../domain/categories/category-template';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { CategoryChecklist } from '../../../../shared/ui/organisms/category-checklist/category-checklist';
import { useShortcuts } from '../../../../shared/ui/services/keyboard-shortcuts';
import { ToastService } from '../../../../shared/ui/services/toast.service';
import { FlowLayout } from '../../../../shared/ui/templates/flow-layout/flow-layout';

const TITLES: Readonly<Record<CategoryKind, string>> = {
  expense: 'Categorías sugeridas',
  income: 'Ingresos sugeridos',
};

/**
 * The suggested categories of a kind (spec Anexo A) as a checklist, everything checked: what is
 * left checked is created at once, and the step's grid opens to adjust it.
 */
@Component({
  selector: 'app-category-template-page',
  imports: [FlowLayout, CategoryChecklist, Button, Message],
  templateUrl: './category-template-page.html',
  styleUrl: './category-template-page.scss',
})
export class CategoryTemplatePage {
  /** Route data: which kind of categories to suggest. */
  readonly categoryKind = input.required<CategoryKind>();

  private readonly categories = inject(CategoriesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly title = computed(() => TITLES[this.categoryKind()]);
  protected readonly nodes = computed(() => templateNodes(CATEGORY_TEMPLATE[this.categoryKind()]));
  protected readonly selected = linkedSignal<readonly string[]>(() => checklistIds(this.nodes()));
  protected readonly createLabel = computed(() => {
    const count = this.selected().length;
    return count === 0 ? 'Crear' : `Crear (${count})`;
  });
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    useShortcuts({
      Escape: () => void this.close(),
      'Mod+s': () => void this.create(),
    });
  }

  protected selectAll(all: boolean): void {
    this.selected.set(all ? checklistIds(this.nodes()) : []);
  }

  protected async create(): Promise<void> {
    if (this.creating() || this.selected().length === 0) {
      return;
    }
    this.creating.set(true);
    this.error.set(null);
    const tree = pickTemplate(this.nodes(), this.selected());
    const created = await this.categories.createTree(this.categoryKind(), tree);
    this.creating.set(false);
    if (!created.ok) {
      this.error.set(created.message);
      return;
    }
    const count = tree.reduce((total, category) => total + 1 + category.children.length, 0);
    void this.toast.show(count === 1 ? 'Se creó 1 categoría.' : `Se crearon ${count} categorías.`);
    await this.close();
  }

  protected async close(): Promise<void> {
    await this.router.navigate(['..'], { relativeTo: this.route });
  }
}
