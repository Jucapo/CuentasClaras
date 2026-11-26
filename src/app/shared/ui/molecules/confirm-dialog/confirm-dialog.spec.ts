import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmService } from '../../services/confirm.service';
import {
  OVERLAY_DATA,
  OverlayHandle,
  OverlayOptions,
  OverlayService,
} from '../../services/overlay.service';
import { ConfirmDialog, ConfirmOptions } from './confirm-dialog';

const OPTIONS: ConfirmOptions = {
  title: '¿Eliminar Hogar?',
  message: 'También se eliminarán sus 2 subcategorías:',
  details: ['Arriendo', 'Servicios'],
  confirmLabel: 'Eliminar',
  destructive: true,
};

describe('ConfirmDialog', () => {
  const close = vi.fn();

  async function create(): Promise<HTMLElement> {
    close.mockReset();
    const handle = new OverlayHandle<boolean>();
    handle.attach(close);
    TestBed.configureTestingModule({
      providers: [
        { provide: OVERLAY_DATA, useValue: OPTIONS },
        { provide: OverlayHandle, useValue: handle },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('states the question and lists what else is affected', async () => {
    const element = await create();
    expect(element.querySelector('h2')?.textContent).toBe('¿Eliminar Hogar?');
    expect(Array.from(element.querySelectorAll('li')).map((item) => item.textContent)).toEqual([
      'Arriendo',
      'Servicios',
    ]);
    expect(element.querySelectorAll('cc-button')[1].classList).toContain('danger');
  });

  it('answers with the button the user pressed', async () => {
    const element = await create();
    const [cancel, confirm] = Array.from(element.querySelectorAll('button'));
    confirm.click();
    expect(close).toHaveBeenLastCalledWith(true);
    cancel.click();
    expect(close).toHaveBeenLastCalledWith(false);
  });
});

describe('ConfirmService', () => {
  const open =
    vi.fn<
      (
        component: Type<unknown>,
        options: OverlayOptions<ConfirmOptions>,
      ) => Promise<boolean | undefined>
    >();

  beforeEach(() => {
    open.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: OverlayService, useValue: { open } }],
    });
  });

  it('treats a dismissed question as no', async () => {
    open.mockResolvedValue(undefined);
    await expect(TestBed.inject(ConfirmService).confirm(OPTIONS)).resolves.toBe(false);
    expect(open.mock.calls[0][0]).toBe(ConfirmDialog);
    expect(open.mock.calls[0][1].size).toBe('confirm');
  });

  it('resolves true when confirmed', async () => {
    open.mockResolvedValue(true);
    await expect(TestBed.inject(ConfirmService).confirm(OPTIONS)).resolves.toBe(true);
  });
});
