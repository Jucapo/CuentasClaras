import { Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { COLOR_PALETTE } from '../../colors/color-palette';
import {
  OVERLAY_DATA,
  OverlayHandle,
  OverlayOptions,
  OverlayService,
} from '../../services/overlay.service';
import { ColorPick, ColorPickerData, ColorPickerPanel } from './color-picker-panel';
import { ColorPicker } from './color-picker';

@Component({
  imports: [ColorPicker, FormField],
  template: `
    <cc-color-picker label="Color" [formField]="f.own" />
    <cc-color-picker label="Color" inheritFrom="orange" [formField]="f.inherited" />
  `,
})
class Host {
  readonly model = signal<{ own: string | null; inherited: string | null }>({
    own: 'teal',
    inherited: null,
  });
  readonly f = form(this.model);
}

describe('ColorPicker', () => {
  const open =
    vi.fn<
      (
        component: Type<unknown>,
        options: OverlayOptions<ColorPickerData>,
      ) => Promise<ColorPick | undefined>
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

  function triggers(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  it('names the current color, or the inherited one', () => {
    const [own, inherited] = triggers();
    expect(own.textContent).toContain('Verde azulado');
    expect(inherited.textContent).toContain('Igual que la categoría (Naranja)');
  });

  it('offers inheriting only when there is a parent color', async () => {
    open.mockResolvedValue({ color: 'red' });
    triggers()[0].click();
    await fixture.whenStable();
    expect(open.mock.calls[0][0]).toBe(ColorPickerPanel);
    expect(open.mock.calls[0][1].data.allowInherit).toBe(false);
    expect(fixture.componentInstance.model().own).toBe('red');

    open.mockResolvedValue({ color: null });
    triggers()[1].click();
    await fixture.whenStable();
    expect(open.mock.calls[1][1].data.allowInherit).toBe(true);
    expect(fixture.componentInstance.model().inherited).toBeNull();
  });
});

describe('ColorPickerPanel', () => {
  const close = vi.fn();

  async function create(allowInherit: boolean): Promise<HTMLElement> {
    close.mockReset();
    const handle = new OverlayHandle<ColorPick>();
    handle.attach(close);
    TestBed.configureTestingModule({
      providers: [
        { provide: OVERLAY_DATA, useValue: { title: 'Color', selected: 'teal', allowInherit } },
        { provide: OverlayHandle, useValue: handle },
      ],
    });
    const fixture = TestBed.createComponent(ColorPickerPanel);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the whole palette and marks the selected color', async () => {
    const element = await create(false);
    expect(element.querySelectorAll('cc-color-swatch').length).toBe(COLOR_PALETTE.length);
    expect(element.querySelector('[data-color="teal"] button')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('closes with the picked color or with inherit', async () => {
    const element = await create(true);
    expect(element.querySelectorAll('cc-color-swatch').length).toBe(COLOR_PALETTE.length + 1);
    element.querySelector<HTMLButtonElement>('[data-color="red"] button')?.click();
    expect(close).toHaveBeenCalledWith({ color: 'red' });
    element.querySelector<HTMLButtonElement>('.inherits')?.click();
    expect(close).toHaveBeenCalledWith({ color: null });
  });
});
