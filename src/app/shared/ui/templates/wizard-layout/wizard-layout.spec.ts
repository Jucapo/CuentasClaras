import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WizardLayout } from './wizard-layout';

@Component({
  imports: [WizardLayout],
  template: `
    <cc-wizard-layout [progress]="progress()">
      <button ccWizardActions type="button">Cerrar sesión</button>
      <p class="step">Tu espacio</p>
    </cc-wizard-layout>
  `,
})
class Host {
  readonly progress = signal<string | undefined>(undefined);
}

describe('WizardLayout', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('puts the actions next to the brand and the step below', () => {
    expect(element().querySelector('.wizard-header cc-brand')).not.toBeNull();
    expect(element().querySelector('.wizard-header .actions button')?.textContent).toBe(
      'Cerrar sesión',
    );
    expect(element().querySelector('.wizard-card .step')?.textContent).toBe('Tu espacio');
  });

  it('only shows the progress when there is one', async () => {
    expect(element().querySelector('.progress')).toBeNull();

    fixture.componentInstance.progress.set('Paso 2 de 7');
    await fixture.whenStable();

    expect(element().querySelector('.progress')?.textContent).toBe('Paso 2 de 7');
  });
});
