import { Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import {
  OVERLAY_DATA,
  OverlayHandle,
  OverlayOptions,
  OverlayService,
} from '../../services/overlay.service';
import { IconPicker } from './icon-picker';
import { IconPickerData, IconPickerPanel } from './icon-picker-panel';

@Component({
  imports: [IconPicker, FormField],
  template: `<cc-icon-picker label="Ícono" color="teal" [formField]="f.icon" />`,
})
class Host {
  readonly model = signal({ icon: 'home' });
  readonly f = form(this.model);
}

describe('IconPicker', () => {
  const open =
    vi.fn<
      (
        component: Type<unknown>,
        options: OverlayOptions<IconPickerData>,
      ) => Promise<string | undefined>
    >();
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    open.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: OverlayService, useValue: { open } }],
    });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function trigger(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
  }

  it('shows the current icon with its Spanish name', () => {
    expect(trigger().textContent).toContain('Ícono');
    expect(trigger().textContent).toContain('Casa');
    expect(trigger().querySelector('cc-icon')?.getAttribute('data-icon')).toBe('home');
  });

  it('opens the catalog and stores the picked icon', async () => {
    open.mockResolvedValue('shopping_cart');
    trigger().click();
    await fixture.whenStable();

    const [component, options] = open.mock.calls[0];
    expect(component).toBe(IconPickerPanel);
    expect(options.data).toEqual({ title: 'Ícono', selected: 'home', color: 'teal' });
    expect(fixture.componentInstance.model().icon).toBe('shopping_cart');
    expect(fixture.componentInstance.f.icon().touched()).toBe(true);
  });

  it('keeps the icon when the picker is dismissed', async () => {
    open.mockResolvedValue(undefined);
    trigger().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.model().icon).toBe('home');
  });
});

describe('IconPickerPanel', () => {
  const close = vi.fn();
  let fixture: ComponentFixture<IconPickerPanel>;

  beforeEach(async () => {
    close.mockReset();
    const handle = new OverlayHandle<string>();
    handle.attach(close);
    TestBed.configureTestingModule({
      providers: [
        { provide: OVERLAY_DATA, useValue: { title: 'Ícono', selected: 'home', color: 'teal' } },
        { provide: OverlayHandle, useValue: handle },
      ],
    });
    fixture = TestBed.createComponent(IconPickerPanel);
    await fixture.whenStable();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the catalog by group and marks the selected icon', () => {
    const titles = Array.from(element().querySelectorAll('.group-title')).map((t) => t.textContent);
    expect(titles[0]).toBe('Hogar');
    expect(titles).toContain('Mascotas');
    expect(element().querySelector('[data-icon="home"].cell')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('filters by Spanish keywords, ignoring accents', async () => {
    const search = element().querySelector('input') as HTMLInputElement;
    search.value = 'credito';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const names = Array.from(element().querySelectorAll<HTMLElement>('.cell')).map(
      (cell) => cell.dataset['icon'],
    );
    expect(names).toContain('credit_card');
    expect(names).not.toContain('home');
  });

  it('closes with the picked icon', () => {
    element().querySelector<HTMLButtonElement>('[data-icon="pets"].cell')?.click();
    expect(close).toHaveBeenCalledWith('pets');
  });
});
