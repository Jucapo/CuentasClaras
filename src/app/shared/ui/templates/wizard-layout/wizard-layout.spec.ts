import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WizardStepItem } from '../../molecules/wizard-steps/wizard-steps';
import { fixedLayout, LayoutService } from '../../services/layout.service';
import { WindowClass } from '../../services/window-class';
import { WizardLayout } from './wizard-layout';

@Component({
  imports: [WizardLayout],
  template: `
    <cc-wizard-layout [progress]="progress()" [steps]="steps" [immersive]="immersive()">
      <button ccWizardActions type="button">Terminar más tarde</button>
      <p class="step">Tu espacio</p>
    </cc-wizard-layout>
  `,
})
class Host {
  readonly progress = signal<string | null>(null);
  readonly immersive = signal(false);
  readonly steps: readonly WizardStepItem[] = [
    { id: 'space', title: 'Tu espacio', state: 'done', link: '/bienvenida/espacio' },
    { id: 'accounts', title: 'Tu situación actual', state: 'current', link: '/bienvenida/cuentas' },
    { id: 'income', title: 'Ingresos', state: 'locked', link: '/bienvenida/ingresos' },
  ];
}

describe('WizardLayout', () => {
  let fixture: ComponentFixture<Host>;

  async function render(windowClass: WindowClass) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LayoutService, useValue: fixedLayout(windowClass) },
      ],
    });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('compact', () => {
    beforeEach(() => render('compact'));

    it('puts the way out next to the brand and the step below', () => {
      expect(element().querySelector('.top-bar cc-brand')).not.toBeNull();
      expect(element().querySelector('.top-actions button')?.textContent).toBe(
        'Terminar más tarde',
      );
      expect(element().querySelector('.card .step')?.textContent).toBe('Tu espacio');
      expect(element().querySelector('cc-wizard-steps')).toBeNull();
    });

    it('shows the progress only when there is one', async () => {
      expect(element().querySelector('.progress')).toBeNull();

      fixture.componentInstance.progress.set('Paso 2 de 3');
      await fixture.whenStable();

      expect(element().querySelector('.progress')?.textContent).toBe('Paso 2 de 3');
      expect(element().querySelectorAll('cc-step-progress .segment')).toHaveLength(3);
    });

    it('leaves the whole screen to an open flow', async () => {
      fixture.componentInstance.immersive.set(true);
      await fixture.whenStable();

      expect(element().querySelector('.top')).toBeNull();
      expect(element().querySelector('.card .step')).not.toBeNull();
    });
  });

  describe('expanded', () => {
    beforeEach(() => render('expanded'));

    it('lists the steps in a side column with the way out', () => {
      const links = [...element().querySelectorAll('.side cc-wizard-steps a')];
      expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
        'Paso 1: Tu espacio, hecho',
        'Paso 2: Tu situación actual',
      ]);
      expect(element().querySelector('.side [aria-disabled="true"]')?.textContent).toContain(
        'Ingresos',
      );
      expect(element().querySelector('.side-actions button')).not.toBeNull();
    });

    it('keeps the steps next to an open flow', async () => {
      fixture.componentInstance.immersive.set(true);
      await fixture.whenStable();

      expect(element().querySelector('.side cc-wizard-steps')).not.toBeNull();
    });
  });
});
